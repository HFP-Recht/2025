import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type Query,
  type DocumentData
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { createHash, randomBytes } from "node:crypto";
import { logger } from "firebase-functions";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  buildGeneratedDraft,
  buildSourceExcerpt,
  chunkSourceText,
  createSourceChecksum,
  normalizeSourceText,
  type PipelineIssue,
  type SourceDocumentRecord,
  type ValidationSummary
} from "./pipeline/aiPipeline";

initializeApp();

const db = getFirestore();
const REGION = "europe-west6";

type PlatformRole = "student" | "teacher" | "admin" | "editor";

interface Claims {
  role?: PlatformRole;
  classIds: string[];
}

type RawSubmissionEntry = {
  id: string;
  classId?: unknown;
  submittedAt?: unknown;
  [key: string]: unknown;
};

type RawAnalyticsEntry = {
  id: string;
  classId?: unknown;
  eventType?: unknown;
  ownerUid?: unknown;
  createdAt?: unknown;
  [key: string]: unknown;
};

type ModuleReviewStatus = "draft" | "review" | "approved" | "published";

const AnswerValueSchema = z.union([z.string(), z.record(z.string(), z.string())]);

const BaseSubmissionSchema = z.object({
  moduleId: z.string().min(1),
  moduleVersionId: z.string().min(1),
  classId: z.string().min(1),
  answers: z.record(z.string(), AnswerValueSchema)
});

const AttemptLookupSchema = z.object({
  moduleId: z.string().min(1),
  moduleVersionId: z.string().min(1)
});

const RegisterStudentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  accessKey: z.string().min(12).max(256),
  displayName: z.string().trim().min(1).max(120).optional()
});

const CreateStudentAccessKeySchema = z.object({
  classId: z.string().min(1),
  maxUses: z.number().int().positive().max(1000).default(30),
  expiresInDays: z.number().int().positive().max(365).default(120),
  note: z.string().trim().max(200).optional()
});

const ModuleLookupSchema = z.object({
  moduleId: z.string().min(1)
});

const ClassQuerySchema = z.object({
  classId: z.string().min(1),
  moduleId: z.preprocess(
    (value) => (value === null ? undefined : value),
    z.string().min(1).optional()
  ),
  limit: z.number().int().positive().max(500).optional()
});

const SubmissionDetailLookupSchema = z.object({
  submissionId: z.string().min(1)
});

const AssignRoleSchema = z.object({
  uid: z.string().min(1),
  role: z.enum(["student", "teacher", "admin", "editor"]),
  classIds: z.array(z.string().min(1)).default([])
});

const PublishModuleSchema = z.object({
  moduleId: z.string().min(1),
  moduleVersionId: z.string().min(1)
});

const StudentExportSchema = z.object({
  targetUid: z.string().min(1).optional()
});

const UpsertSourceDocumentSchema = z.object({
  sourceDocumentId: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z0-9._-]+$/),
  title: z.string().trim().min(3).max(180),
  content: z.string().trim().min(40),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  replaceExisting: z.boolean().optional()
});

const GenerateModuleDraftSchema = z.object({
  moduleId: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z0-9._-]+$/),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(10).max(2000),
  outcomes: z.array(z.string().trim().min(1).max(240)).min(1).max(12),
  sourceDocumentIds: z
    .array(z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9._-]+$/))
    .min(1)
    .max(20)
});

const ReviewQueueQuerySchema = z.object({
  limit: z.number().int().positive().max(200).optional(),
  statuses: z.array(z.enum(["draft", "review", "approved"])).min(1).max(3).optional()
});

const ModuleVersionLookupSchema = z.object({
  moduleVersionId: z.string().trim().min(1)
});

const ReviewStatusTransitionSchema = z.object({
  moduleVersionId: z.string().trim().min(1),
  nextStatus: z.enum(["draft", "review", "approved"]),
  note: z.string().trim().max(500).optional()
});

const SessionEventSchema = z.object({
  moduleId: z.string().trim().min(1),
  moduleVersionId: z.string().trim().min(1).optional(),
  classId: z.string().trim().min(1).optional(),
  eventType: z.enum(["module_open", "embed_open", "module_submit", "module_complete"]),
  origin: z.string().trim().max(120).optional()
});

const PilotMetricsSchema = z.object({
  moduleId: z.string().trim().min(1),
  classId: z.string().trim().min(1).optional()
});

export const getPublishedModule = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  const input = parseData(ModuleLookupSchema, request.data);

  const moduleSnapshot = await db.collection("modules").doc(input.moduleId).get();
  if (!moduleSnapshot.exists) {
    throw new HttpsError("not-found", "Module not found.");
  }

  const moduleData = moduleSnapshot.data() ?? {};
  const publishedVersionId = String(moduleData.publishedVersionId ?? "");
  if (!publishedVersionId) {
    throw new HttpsError("failed-precondition", "Module has no published version.");
  }

  const versionSnapshot = await db.collection("moduleVersions").doc(publishedVersionId).get();
  if (!versionSnapshot.exists) {
    throw new HttpsError("not-found", "Published module version not found.");
  }

  const versionData = versionSnapshot.data() ?? {};
  const status = String(versionData.status ?? "draft");

  if (claims.role === "student" && status !== "published") {
    throw new HttpsError("permission-denied", "Students can only access published module versions.");
  }

  return {
    module: versionData.content ?? versionData
  };
});

export const listSourceDocuments = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["teacher", "admin", "editor"]);

  const snapshot = await db.collection("sourceDocuments").orderBy("updatedAt", "desc").limit(300).get();

  const sources = snapshot.docs.map((doc) => {
    const data = doc.data() ?? {};
    return {
      sourceDocumentId: doc.id,
      title: String(data.title ?? doc.id),
      excerpt: String(data.excerpt ?? ""),
      checksum: String(data.checksum ?? ""),
      chunkCount: Number(data.chunkCount ?? 0),
      tags: toStringArray(data.tags),
      updatedAt: toIso(data.updatedAt),
      createdAt: toIso(data.createdAt)
    };
  });

  return { sources };
});

export const upsertSourceDocument = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["admin", "editor"]);

  const input = parseData(UpsertSourceDocumentSchema, request.data);
  const sourceDocumentId = input.sourceDocumentId.trim();
  const sourceRef = db.collection("sourceDocuments").doc(sourceDocumentId);
  const existingSnapshot = await sourceRef.get();

  if (existingSnapshot.exists && !input.replaceExisting) {
    throw new HttpsError(
      "already-exists",
      "Source document already exists. Set replaceExisting=true to overwrite."
    );
  }

  const normalizedContent = normalizeSourceText(input.content);
  const chunks = chunkSourceText(normalizedContent);
  if (chunks.length === 0) {
    throw new HttpsError("invalid-argument", "Source document does not contain enough content.");
  }

  const existingChunks = await db
    .collection("sourceChunks")
    .where("sourceDocumentId", "==", sourceDocumentId)
    .get();
  await deleteSnapshotsInBatches(existingChunks.docs);

  const checksum = createSourceChecksum(normalizedContent);
  const excerpt = buildSourceExcerpt(normalizedContent, 260);
  const tags = Array.from(
    new Set((input.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0))
  );

  await sourceRef.set(
    {
      sourceDocumentId,
      title: input.title.trim(),
      content: normalizedContent,
      checksum,
      excerpt,
      chunkCount: chunks.length,
      tags,
      createdByUid: auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await writeChunksInBatches(sourceDocumentId, chunks, auth.uid);

  await writeAuditLog(auth.uid, "upsertSourceDocument", sourceDocumentId, {
    chunkCount: chunks.length,
    checksum,
    replaced: existingSnapshot.exists
  });

  return {
    sourceDocumentId,
    chunkCount: chunks.length,
    checksum,
    excerpt
  };
});

export const generateModuleDraft = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["admin", "editor"]);

  const input = parseData(GenerateModuleDraftSchema, request.data);
  const moduleId = input.moduleId.trim().toLowerCase();

  const sourceRefs = input.sourceDocumentIds.map((sourceDocumentId) =>
    db.collection("sourceDocuments").doc(sourceDocumentId)
  );

  const sourceSnapshots = sourceRefs.length > 0 ? await db.getAll(...sourceRefs) : [];
  const missingSources = input.sourceDocumentIds.filter(
    (_sourceDocumentId, index) => !sourceSnapshots[index]?.exists
  );

  if (missingSources.length > 0) {
    throw new HttpsError(
      "not-found",
      `Source document(s) not found: ${missingSources.join(", ")}`
    );
  }

  const sourceDocuments: SourceDocumentRecord[] = sourceSnapshots.map((snapshot) => {
    const data = snapshot.data() ?? {};
    return {
      sourceDocumentId: snapshot.id,
      title: String(data.title ?? snapshot.id),
      content: String(data.content ?? ""),
      tags: toStringArray(data.tags),
      chunkCount: Number(data.chunkCount ?? 0)
    };
  });

  const existingVersions = await db.collection("moduleVersions").where("moduleId", "==", moduleId).get();
  const nextVersion =
    existingVersions.docs.reduce((maxVersion, doc) => {
      const data = doc.data() ?? {};
      const versionNumber = Number(data.versionNumber ?? data.content?.version ?? 0);
      return Number.isFinite(versionNumber) ? Math.max(maxVersion, versionNumber) : maxVersion;
    }, 0) + 1;

  const draft = buildGeneratedDraft({
    moduleId,
    title: input.title,
    description: input.description,
    outcomes: input.outcomes,
    sourceDocuments,
    version: nextVersion,
    generatedBy: `callable:${claims.role ?? "unknown"}`
  });

  const moduleVersionId = `${moduleId}_v${nextVersion}`;

  await db.collection("moduleVersions").doc(moduleVersionId).set(
    {
      moduleVersionId,
      moduleId,
      versionNumber: nextVersion,
      status: "draft",
      content: draft.module,
      validationIssues: draft.issues,
      validationSummary: draft.validationSummary,
      generation: {
        sourceDocumentIds: input.sourceDocumentIds,
        promptBundle: draft.promptBundle,
        citations: draft.citations,
        promptContractVersion: "1.0.0"
      },
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      createdByUid: auth.uid
    },
    { merge: true }
  );

  await db.collection("modules").doc(moduleId).set(
    {
      moduleId,
      title: input.title.trim(),
      description: input.description.trim(),
      outcomes: input.outcomes,
      latestDraftVersionId: moduleVersionId,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await writeAuditLog(auth.uid, "generateModuleDraft", moduleVersionId, {
    moduleId,
    sourceDocumentIds: input.sourceDocumentIds,
    errorCount: draft.validationSummary.errorCount,
    warningCount: draft.validationSummary.warningCount
  });

  return {
    moduleVersionId,
    moduleId,
    versionNumber: nextVersion,
    status: "draft",
    validationSummary: draft.validationSummary,
    validationIssues: draft.issues,
    citations: draft.citations,
    promptBundle: draft.promptBundle
  };
});

export const listReviewQueue = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["teacher", "admin", "editor"]);

  const input = parseData(ReviewQueueQuerySchema, request.data ?? {});
  const statuses = input.statuses ?? ["draft", "review", "approved"];

  let query: Query = db.collection("moduleVersions");
  if (statuses.length === 1) {
    query = query.where("status", "==", statuses[0]);
  } else {
    query = query.where("status", "in", statuses);
  }

  const snapshot = await query.orderBy("updatedAt", "desc").limit(input.limit ?? 60).get();

  const items = snapshot.docs.map((doc) => {
    const data = doc.data() ?? {};
    const content = isObjectRecord(data.content) ? data.content : {};
    const summary = toValidationSummary(data.validationSummary);

    return {
      moduleVersionId: doc.id,
      moduleId: String(data.moduleId ?? content.moduleId ?? ""),
      title: String(content.title ?? data.title ?? "Untitled module"),
      versionNumber: Number(data.versionNumber ?? content.version ?? 0),
      status: normalizeModuleStatus(data.status),
      updatedAt: toIso(data.updatedAt),
      errorCount: summary.errorCount,
      warningCount: summary.warningCount,
      sourceDocumentCount: Array.isArray(data.generation?.sourceDocumentIds)
        ? data.generation.sourceDocumentIds.length
        : 0
    };
  });

  return { items };
});

export const getModuleVersionDetail = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["teacher", "admin", "editor"]);

  const input = parseData(ModuleVersionLookupSchema, request.data);
  const snapshot = await db.collection("moduleVersions").doc(input.moduleVersionId).get();

  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Module version not found.");
  }

  const data = snapshot.data() ?? {};

  return {
    moduleVersion: {
      moduleVersionId: snapshot.id,
      moduleId: String(data.moduleId ?? ""),
      status: normalizeModuleStatus(data.status),
      versionNumber: Number(data.versionNumber ?? 0),
      updatedAt: toIso(data.updatedAt),
      createdAt: toIso(data.createdAt),
      content: data.content ?? null,
      validationSummary: toValidationSummary(data.validationSummary),
      validationIssues: toPipelineIssues(data.validationIssues),
      reviewHistory: Array.isArray(data.reviewHistory) ? data.reviewHistory : []
    }
  };
});

export const updateModuleReviewStatus = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["teacher", "admin", "editor"]);

  const input = parseData(ReviewStatusTransitionSchema, request.data);
  const moduleVersionRef = db.collection("moduleVersions").doc(input.moduleVersionId);
  const snapshot = await moduleVersionRef.get();

  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Module version not found.");
  }

  const data = snapshot.data() ?? {};
  const currentStatus = normalizeModuleStatus(data.status);

  if (currentStatus === "published") {
    throw new HttpsError("failed-precondition", "Published versions must be superseded by new drafts.");
  }

  if (!isAllowedReviewTransition(currentStatus, input.nextStatus)) {
    throw new HttpsError(
      "failed-precondition",
      `Invalid status transition from '${currentStatus}' to '${input.nextStatus}'.`
    );
  }

  const summary = toValidationSummary(data.validationSummary);
  if (input.nextStatus === "approved" && summary.errorCount > 0) {
    throw new HttpsError(
      "failed-precondition",
      "Cannot approve module version while validation errors remain."
    );
  }

  const nowIso = new Date().toISOString();
  const existingContent = isObjectRecord(data.content) ? data.content : {};

  await moduleVersionRef.set(
    {
      status: input.nextStatus,
      content: {
        ...existingContent,
        status: input.nextStatus
      },
      reviewHistory: FieldValue.arrayUnion({
        fromStatus: currentStatus,
        toStatus: input.nextStatus,
        actorUid: auth.uid,
        note: input.note ?? "",
        at: nowIso
      }),
      reviewUpdatedByUid: auth.uid,
      reviewUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await writeAuditLog(auth.uid, "updateModuleReviewStatus", input.moduleVersionId, {
    fromStatus: currentStatus,
    toStatus: input.nextStatus,
    note: input.note ?? ""
  });

  return {
    ok: true,
    moduleVersionId: input.moduleVersionId,
    status: input.nextStatus
  };
});

export const trackSessionEvent = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["student", "teacher", "admin", "editor"]);

  const input = parseData(SessionEventSchema, request.data);
  const classId = input.classId?.trim() || claims.classIds[0] || "";
  if (classId) {
    requireClassAccess(claims, classId);
  }

  await db.collection("analyticsEvents").add({
    ownerUid: auth.uid,
    role: claims.role ?? null,
    classId,
    moduleId: input.moduleId,
    moduleVersionId: input.moduleVersionId ?? "",
    eventType: input.eventType,
    origin: input.origin ?? "direct",
    createdAt: FieldValue.serverTimestamp()
  });

  return { ok: true };
});

export const getPilotMetrics = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["teacher", "admin", "editor"]);

  const input = parseData(PilotMetricsSchema, request.data);
  const classFilter = input.classId?.trim();
  if (classFilter) {
    requireClassAccess(claims, classFilter);
  }

  const submissionSnapshot = await db
    .collection("submissions")
    .where("moduleId", "==", input.moduleId)
    .limit(2000)
    .get();

  const analyticsSnapshot = await db
    .collection("analyticsEvents")
    .where("moduleId", "==", input.moduleId)
    .limit(4000)
    .get();

  const allowedClassIds = claims.role === "admin" ? null : new Set(claims.classIds);

  const submissions: RawSubmissionEntry[] = submissionSnapshot.docs
    .map(
      (doc) =>
        ({
          id: doc.id,
          ...(doc.data() as Record<string, unknown>)
        }) as RawSubmissionEntry
    )
    .filter((entry) => {
      const classId = String(entry.classId ?? "");
      if (classFilter && classId !== classFilter) {
        return false;
      }
      if (allowedClassIds && (!classId || !allowedClassIds.has(classId))) {
        return false;
      }
      return true;
    });

  const analyticsEvents: RawAnalyticsEntry[] = analyticsSnapshot.docs
    .map(
      (doc) =>
        ({
          id: doc.id,
          ...(doc.data() as Record<string, unknown>)
        }) as RawAnalyticsEntry
    )
    .filter((entry) => {
      const classId = String(entry.classId ?? "");
      if (classFilter && classId !== classFilter) {
        return false;
      }
      if (allowedClassIds && (!classId || !allowedClassIds.has(classId))) {
        return false;
      }
      return true;
    });

  const openEvents = analyticsEvents.filter(
    (entry) => entry.eventType === "module_open" || entry.eventType === "embed_open"
  );
  const iframeEvents = analyticsEvents.filter((entry) => entry.eventType === "embed_open");
  const submitEvents = analyticsEvents.filter((entry) => entry.eventType === "module_submit");

  const uniqueOpenUsers = new Set(
    openEvents.map((entry) => String(entry.ownerUid ?? "")).filter((uid) => uid.length > 0)
  );
  const uniqueSubmissionUsers = new Set(
    submissions
      .map((entry) => String(entry.ownerUid ?? ""))
      .filter((uid) => uid.length > 0)
  );

  const completionRate =
    uniqueOpenUsers.size > 0
      ? Number((uniqueSubmissionUsers.size / uniqueOpenUsers.size).toFixed(3))
      : 0;

  const latestSubmissionAt = submissions
    .map((entry) => toIso(entry.submittedAt))
    .filter((timestamp) => timestamp.length > 0)
    .sort()
    .at(-1) ?? "";

  return {
    metrics: {
      moduleId: input.moduleId,
      classFilter: classFilter ?? null,
      openEvents: openEvents.length,
      iframeOpenEvents: iframeEvents.length,
      submitEvents: submitEvents.length,
      submissions: submissions.length,
      uniqueOpenUsers: uniqueOpenUsers.size,
      uniqueSubmissionUsers: uniqueSubmissionUsers.size,
      completionRate,
      latestSubmissionAt
    }
  };
});

export const saveAttempt = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["student"]);

  const input = parseData(BaseSubmissionSchema, request.data);
  requireClassAccess(claims, input.classId);

  const attemptId = `${auth.uid}_${input.moduleId}_${input.moduleVersionId}`;

  await db
    .collection("attempts")
    .doc(attemptId)
    .set(
      {
        attemptId,
        ownerUid: auth.uid,
        classId: input.classId,
        moduleId: input.moduleId,
        moduleVersionId: input.moduleVersionId,
        status: "draft",
        answers: input.answers,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

  return { attemptId };
});

export const getMyAttempt = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const input = parseData(AttemptLookupSchema, request.data);

  const attemptId = `${auth.uid}_${input.moduleId}_${input.moduleVersionId}`;
  const snapshot = await db.collection("attempts").doc(attemptId).get();

  if (!snapshot.exists) {
    return { attempt: null };
  }

  const data = snapshot.data() ?? {};
  if (String(data.ownerUid ?? "") !== auth.uid) {
    throw new HttpsError("permission-denied", "Attempt does not belong to current user.");
  }

  return {
    attempt: {
      attemptId,
      ownerUid: auth.uid,
      classId: String(data.classId ?? ""),
      moduleId: String(data.moduleId ?? input.moduleId),
      moduleVersionId: String(data.moduleVersionId ?? input.moduleVersionId),
      status: String(data.status ?? "draft"),
      answers: isAnswersRecord(data.answers) ? data.answers : {},
      updatedAt: toIso(data.updatedAt),
      submittedAt: toIso(data.submittedAt)
    }
  };
});

export const createStudentAccessKey = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["admin"]);

  const input = parseData(CreateStudentAccessKeySchema, request.data);
  const maxUses = input.maxUses ?? 30;
  const expiresInDays = input.expiresInDays ?? 120;
  const accessKey = `stu_${randomBytes(16).toString("hex")}`;
  const keyHash = hashAccessKey(accessKey);
  const expiresAt = Timestamp.fromDate(
    new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
  );

  await db
    .collection("studentAccessKeys")
    .doc(keyHash)
    .set({
      keyHash,
      classId: input.classId,
      role: "student",
      maxUses,
      usedCount: 0,
      active: true,
      note: input.note ?? "",
      createdByUid: auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt
    });

  await writeAuditLog(auth.uid, "createStudentAccessKey", keyHash, {
    classId: input.classId,
    maxUses,
    expiresAt: expiresAt.toDate().toISOString()
  });

  return {
    accessKey,
    classId: input.classId,
    maxUses,
    expiresAt: expiresAt.toDate().toISOString()
  };
});

export const registerStudentWithAccessKey = onCall({ region: REGION }, async (request) => {
  const input = parseData(RegisterStudentSchema, request.data);
  const keyHash = hashAccessKey(input.accessKey.trim());
  const keyRef = db.collection("studentAccessKeys").doc(keyHash);

  const keySnapshot = await keyRef.get();
  const keyValidation = validateStudentAccessKey(keySnapshot.data());
  if (!keySnapshot.exists || !keyValidation.valid) {
    throw new HttpsError("permission-denied", keyValidation.message ?? "Invalid access key.");
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  let userRecord;

  try {
    userRecord = await getAuth().createUser({
      email: normalizedEmail,
      password: input.password,
      displayName: input.displayName?.trim() || undefined
    });
  } catch (error) {
    const authError = error as { code?: string };
    if (authError.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Email already registered.");
    }
    throw new HttpsError("internal", "Could not create student account.");
  }

  try {
    await db.runTransaction(async (transaction) => {
      const latestKeySnapshot = await transaction.get(keyRef);
      const latestValidation = validateStudentAccessKey(latestKeySnapshot.data());
      if (!latestKeySnapshot.exists || !latestValidation.valid) {
        throw new HttpsError(
          "resource-exhausted",
          latestValidation.message ?? "Access key is no longer valid."
        );
      }

      const latestData = latestKeySnapshot.data() as Record<string, unknown>;
      const currentUsedCount = Number(latestData.usedCount ?? 0);

      transaction.set(
        keyRef,
        {
          usedCount: currentUsedCount + 1,
          lastUsedAt: FieldValue.serverTimestamp(),
          lastRedeemedUid: userRecord.uid,
          lastRedeemedEmail: normalizedEmail
        },
        { merge: true }
      );
    });
  } catch (error) {
    await getAuth().deleteUser(userRecord.uid).catch(() => undefined);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("permission-denied", "Access key can no longer be used.");
  }

  try {
    await getAuth().setCustomUserClaims(userRecord.uid, {
      role: "student",
      classIds: [keyValidation.classId]
    });

    await db.collection("users").doc(userRecord.uid).set(
      {
        uid: userRecord.uid,
        role: "student",
        classIds: [keyValidation.classId],
        email: normalizedEmail,
        displayName: input.displayName?.trim() || "",
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  } catch {
    await getAuth().deleteUser(userRecord.uid).catch(() => undefined);
    await keyRef
      .set(
        {
          usedCount: FieldValue.increment(-1)
        },
        { merge: true }
      )
      .catch(() => undefined);

    throw new HttpsError("internal", "Could not finalize registration.");
  }

  await writeAuditLog(userRecord.uid, "studentSelfRegistration", userRecord.uid, {
    classId: keyValidation.classId,
    keyRef: keyHash.slice(0, 10)
  });

  return {
    uid: userRecord.uid,
    role: "student",
    classId: keyValidation.classId
  };
});

export const getMySubmissions = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const moduleFilter = parseOptionalModuleFilter(request.data);

  let query: Query = db.collection("submissions").where("ownerUid", "==", auth.uid);
  if (moduleFilter) {
    query = query.where("moduleId", "==", moduleFilter);
  }

  const snapshot = await query.orderBy("submittedAt", "desc").limit(200).get();
  const submissions = snapshot.docs.map((doc) => toSubmissionSummary(doc.id, doc.data()));

  return { submissions };
});

export const submitModule = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["student"]);

  const input = parseData(BaseSubmissionSchema, request.data);
  requireClassAccess(claims, input.classId);

  if (Object.keys(input.answers).length === 0) {
    throw new HttpsError("failed-precondition", "Submission requires at least one answer.");
  }

  const attemptId = `${auth.uid}_${input.moduleId}_${input.moduleVersionId}`;
  const submissionRef = db.collection("submissions").doc();

  await db.runTransaction(async (transaction) => {
    transaction.set(submissionRef, {
      submissionId: submissionRef.id,
      ownerUid: auth.uid,
      classId: input.classId,
      moduleId: input.moduleId,
      moduleVersionId: input.moduleVersionId,
      attemptId,
      answers: input.answers,
      submittedAt: FieldValue.serverTimestamp()
    });

    transaction.set(
      db.collection("attempts").doc(attemptId),
      {
        status: "submitted",
        submittedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        answers: input.answers
      },
      { merge: true }
    );
  });

  return { submissionId: submissionRef.id };
});

export const getClassSubmissions = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["teacher", "admin"]);

  const input = parseData(ClassQuerySchema, request.data);
  requireClassAccess(claims, input.classId);

  let query: Query = db.collection("submissions").where("classId", "==", input.classId);
  if (input.moduleId) {
    query = query.where("moduleId", "==", input.moduleId);
  }

  const snapshot = await query
    .orderBy("submittedAt", "desc")
    .limit(input.limit ?? 200)
    .get();

  const submissions = snapshot.docs.map((doc) => toSubmissionSummary(doc.id, doc.data()));

  return { submissions };
});

export const getSubmissionDetail = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["teacher", "admin"]);

  const input = parseData(SubmissionDetailLookupSchema, request.data);
  const snapshot = await db.collection("submissions").doc(input.submissionId).get();

  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Submission not found.");
  }

  const data = snapshot.data() ?? {};
  const classId = String(data.classId ?? "");
  if (!classId) {
    throw new HttpsError("failed-precondition", "Submission has no class assignment.");
  }

  requireClassAccess(claims, classId);

  return {
    submission: {
      submissionId: snapshot.id,
      ownerUid: String(data.ownerUid ?? ""),
      classId,
      moduleId: String(data.moduleId ?? ""),
      moduleVersionId: String(data.moduleVersionId ?? ""),
      attemptId: String(data.attemptId ?? ""),
      submittedAt: toIso(data.submittedAt),
      answers: isAnswersRecord(data.answers) ? data.answers : {}
    }
  };
});

export const exportStudentPortfolio = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["student", "teacher", "admin"]);

  const input = parseData(StudentExportSchema, request.data);
  const targetUid = input.targetUid ?? auth.uid;

  if (claims.role === "student" && targetUid !== auth.uid) {
    throw new HttpsError("permission-denied", "Students can only export their own data.");
  }

  const snapshot = await db
    .collection("submissions")
    .where("ownerUid", "==", targetUid)
    .orderBy("submittedAt", "desc")
    .limit(500)
    .get();

  const submissions: RawSubmissionEntry[] = snapshot.docs
    .map(
      (doc) =>
        ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }) as RawSubmissionEntry
    )
    .filter((entry) => {
      if (claims.role !== "teacher") {
        return true;
      }
      return claims.classIds.includes(String(entry.classId));
    })
    .map((entry) => ({
      ...entry,
      submittedAt: toIso(entry.submittedAt)
    }));

  const payload = {
    ownerUid: targetUid,
    exportedAt: new Date().toISOString(),
    submissions
  };

  const json = JSON.stringify(payload, null, 2);
  const exportPath = `exports/students/${targetUid}/portfolio-${Date.now()}.json`;
  const persisted = await persistExport(exportPath, json, "application/json");

  return {
    json,
    exportPath: persisted.exportPath,
    downloadUrl: persisted.downloadUrl,
    recordCount: submissions.length
  };
});

export const exportClassCsv = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["teacher", "admin"]);

  const input = parseData(ClassQuerySchema, request.data);
  requireClassAccess(claims, input.classId);

  let query: Query = db.collection("submissions").where("classId", "==", input.classId);
  if (input.moduleId) {
    query = query.where("moduleId", "==", input.moduleId);
  }

  const snapshot = await query
    .orderBy("submittedAt", "desc")
    .limit(input.limit ?? 500)
    .get();

  const rows = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      submissionId: doc.id,
      ownerUid: String(data.ownerUid ?? ""),
      classId: String(data.classId ?? ""),
      moduleId: String(data.moduleId ?? ""),
      moduleVersionId: String(data.moduleVersionId ?? ""),
      submittedAt: toIso(data.submittedAt)
    };
  });

  const csv = toCsv(rows);
  const exportPath = `exports/classes/${input.classId}/submissions-${Date.now()}.csv`;
  const persisted = await persistExport(exportPath, csv, "text/csv");

  return {
    csv,
    exportPath: persisted.exportPath,
    downloadUrl: persisted.downloadUrl,
    recordCount: rows.length
  };
});

export const assignUserRole = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["admin"]);

  const input = parseData(AssignRoleSchema, request.data);

  await getAuth().setCustomUserClaims(input.uid, {
    role: input.role,
    classIds: input.classIds
  });

  await db.collection("users").doc(input.uid).set(
    {
      uid: input.uid,
      role: input.role,
      classIds: input.classIds,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await writeAuditLog(auth.uid, "assignUserRole", input.uid, {
    role: input.role,
    classIds: input.classIds
  });

  return { ok: true };
});

export const publishModuleVersion = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const claims = getClaims(auth);
  requireRole(claims, ["admin"]);

  const input = parseData(PublishModuleSchema, request.data);
  const versionRef = db.collection("moduleVersions").doc(input.moduleVersionId);
  const versionSnapshot = await versionRef.get();

  if (!versionSnapshot.exists) {
    throw new HttpsError("not-found", "Module version not found.");
  }

  const versionData = versionSnapshot.data() ?? {};
  const currentStatus = normalizeModuleStatus(versionData.status);
  if (currentStatus !== "approved") {
    throw new HttpsError(
      "failed-precondition",
      "Only approved module versions can be published."
    );
  }

  const existingContent = isObjectRecord(versionData.content) ? versionData.content : {};

  await db.runTransaction(async (transaction) => {
    transaction.set(
      versionRef,
      {
        status: "published",
        content: {
          ...existingContent,
          status: "published"
        },
        publishedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    transaction.set(
      db.collection("modules").doc(input.moduleId),
      {
        moduleId: input.moduleId,
        publishedVersionId: input.moduleVersionId,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });

  await writeAuditLog(auth.uid, "publishModuleVersion", input.moduleId, {
    moduleVersionId: input.moduleVersionId
  });

  return { ok: true };
});

function requireAuth(request: CallableRequest<unknown>): NonNullable<CallableRequest<unknown>["auth"]> {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  return request.auth;
}

function getClaims(auth: NonNullable<CallableRequest<unknown>["auth"]>): Claims {
  const roleRaw = auth.token.role;
  const role =
    typeof roleRaw === "string" && ["student", "teacher", "admin", "editor"].includes(roleRaw)
      ? (roleRaw as PlatformRole)
      : undefined;

  const classIdsRaw = auth.token.classIds;
  const classIds = Array.isArray(classIdsRaw)
    ? classIdsRaw.filter((entry): entry is string => typeof entry === "string")
    : [];

  return { role, classIds };
}

function requireRole(claims: Claims, allowed: PlatformRole[]): void {
  if (!claims.role || !allowed.includes(claims.role)) {
    throw new HttpsError(
      "permission-denied",
      `Operation requires one of roles: ${allowed.join(", ")}`
    );
  }
}

function requireClassAccess(claims: Claims, classId: string): void {
  if (claims.role === "admin") {
    return;
  }

  if (!claims.classIds.includes(classId)) {
    throw new HttpsError("permission-denied", `Missing class scope for class '${classId}'.`);
  }
}

function parseData<T>(schema: z.ZodSchema<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new HttpsError("invalid-argument", details);
  }
  return result.data;
}

function parseOptionalModuleFilter(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const data = payload as { moduleId?: unknown };
  if (typeof data.moduleId === "string" && data.moduleId.trim().length > 0) {
    return data.moduleId.trim();
  }

  return undefined;
}

function hashAccessKey(accessKey: string): string {
  return createHash("sha256").update(accessKey).digest("hex");
}

function isAnswersRecord(value: unknown): value is Record<string, string | Record<string, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  return entries.every(([, answer]) => {
    if (typeof answer === "string") {
      return true;
    }

    if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
      return false;
    }

    return Object.values(answer as Record<string, unknown>).every(
      (innerValue) => typeof innerValue === "string"
    );
  });
}

function validateStudentAccessKey(data: Record<string, unknown> | undefined): {
  valid: boolean;
  classId: string;
  message?: string;
} {
  if (!data) {
    return { valid: false, classId: "", message: "Invalid access key." };
  }

  const classId = String(data.classId ?? "").trim();
  const maxUses = Number(data.maxUses ?? 0);
  const usedCount = Number(data.usedCount ?? 0);
  const active = data.active === true;

  if (!active) {
    return { valid: false, classId, message: "Access key is inactive." };
  }

  if (!classId) {
    return { valid: false, classId: "", message: "Access key has no class assignment." };
  }

  if (!Number.isFinite(maxUses) || maxUses <= 0) {
    return { valid: false, classId, message: "Access key configuration is invalid." };
  }

  if (!Number.isFinite(usedCount) || usedCount >= maxUses) {
    return { valid: false, classId, message: "Access key usage limit reached." };
  }

  const expiresAt = data.expiresAt;
  if (expiresAt instanceof Timestamp && expiresAt.toDate().getTime() < Date.now()) {
    return { valid: false, classId, message: "Access key has expired." };
  }

  return { valid: true, classId };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

async function deleteSnapshotsInBatches(
  snapshots: Array<{ ref: unknown }>
): Promise<void> {
  for (const snapshot of snapshots) {
    const ref = snapshot.ref as { delete: () => Promise<unknown> };
    await ref.delete();
  }
}

async function writeChunksInBatches(
  sourceDocumentId: string,
  chunks: Array<{ chunkId: string; chunkIndex: number; text: string; tokenEstimate: number }>,
  actorUid: string
): Promise<void> {
  const batchSize = 350;
  for (let index = 0; index < chunks.length; index += batchSize) {
    const batch = db.batch();
    const slice = chunks.slice(index, index + batchSize);

    slice.forEach((chunk) => {
      const chunkRef = db.collection("sourceChunks").doc(`${sourceDocumentId}_${chunk.chunkId}`);
      batch.set(chunkRef, {
        sourceDocumentId,
        chunkId: chunk.chunkId,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        tokenEstimate: chunk.tokenEstimate,
        createdByUid: actorUid,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
  }
}

function toValidationSummary(value: unknown): ValidationSummary {
  if (!value || typeof value !== "object") {
    return {
      errorCount: 0,
      warningCount: 0
    };
  }

  const record = value as Record<string, unknown>;
  const errorCount = Number(record.errorCount ?? 0);
  const warningCount = Number(record.warningCount ?? 0);

  return {
    errorCount: Number.isFinite(errorCount) ? errorCount : 0,
    warningCount: Number.isFinite(warningCount) ? warningCount : 0
  };
}

function toPipelineIssues(value: unknown): PipelineIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const severity = record.severity === "warning" ? "warning" : "error";

      return {
        code: String(record.code ?? "unknown_issue"),
        path: String(record.path ?? "root"),
        message: String(record.message ?? "Validation issue"),
        severity
      } as PipelineIssue;
    })
    .filter((entry): entry is PipelineIssue => entry !== null);
}

function normalizeModuleStatus(value: unknown): ModuleReviewStatus {
  if (value === "review" || value === "approved" || value === "published") {
    return value;
  }
  return "draft";
}

function isAllowedReviewTransition(
  currentStatus: ModuleReviewStatus,
  nextStatus: "draft" | "review" | "approved"
): boolean {
  if (currentStatus === "draft") {
    return nextStatus === "review";
  }

  if (currentStatus === "review") {
    return nextStatus === "approved" || nextStatus === "draft";
  }

  if (currentStatus === "approved") {
    return nextStatus === "review";
  }

  return false;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toSubmissionSummary(id: string, data: DocumentData) {
  return {
    submissionId: id,
    ownerUid: String(data.ownerUid ?? ""),
    classId: String(data.classId ?? ""),
    moduleId: String(data.moduleId ?? ""),
    moduleVersionId: String(data.moduleVersionId ?? ""),
    submittedAt: toIso(data.submittedAt)
  };
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return "";
}

function toCsv(rows: Array<Record<string, string>>): string {
  if (rows.length === 0) {
    return "submissionId,ownerUid,classId,moduleId,moduleVersionId,submittedAt\n";
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];

  for (const row of rows) {
    const values = headers.map((header) => csvEscape(row[header] ?? ""));
    lines.push(values.join(","));
  }

  return `${lines.join("\n")}\n`;
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function persistExport(
  exportPath: string,
  content: string,
  contentType: string
): Promise<{ exportPath: string | null; downloadUrl: string | null }> {
  try {
    const bucket = getStorage().bucket();
    const file = bucket.file(exportPath);
    await file.save(content, {
      contentType,
      resumable: false,
      metadata: {
        cacheControl: "private, max-age=0"
      }
    });

    const [downloadUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000
    });

    return {
      exportPath,
      downloadUrl
    };
  } catch (error) {
    logger.warn("Export persistence skipped", error as Error);
    return {
      exportPath: null,
      downloadUrl: null
    };
  }
}

async function writeAuditLog(
  actorUid: string,
  action: string,
  targetId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await db.collection("auditLogs").add({
    actorUid,
    action,
    targetId,
    payload,
    createdAt: FieldValue.serverTimestamp()
  });
}
