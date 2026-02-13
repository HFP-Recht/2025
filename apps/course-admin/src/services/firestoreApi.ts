import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export interface SubmissionSummary {
  submissionId: string;
  ownerUid: string;
  classId: string;
  moduleId: string;
  moduleVersionId: string;
  submittedAt: string;
}

export type SubmissionAnswerValue = string | Record<string, string>;

export interface SubmissionDetail {
  submissionId: string;
  ownerUid: string;
  classId: string;
  moduleId: string;
  moduleVersionId: string;
  attemptId: string;
  submittedAt: string;
  answers: Record<string, SubmissionAnswerValue>;
}

export interface CreatedStudentAccessKey {
  accessKey: string;
  classId: string;
  maxUses: number;
  expiresAt: string;
}

export type ReviewStatus = "draft" | "review" | "approved" | "published";

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationSummary {
  errorCount: number;
  warningCount: number;
}

export interface SourceDocumentSummary {
  sourceDocumentId: string;
  title: string;
  excerpt: string;
  checksum: string;
  chunkCount: number;
  tags: string[];
  updatedAt: string;
  createdAt: string;
}

export interface ReviewQueueItem {
  moduleVersionId: string;
  moduleId: string;
  title: string;
  versionNumber: number;
  status: ReviewStatus;
  updatedAt: string;
  errorCount: number;
  warningCount: number;
  sourceDocumentCount: number;
}

export interface ModuleVersionDetail {
  moduleVersionId: string;
  moduleId: string;
  status: ReviewStatus;
  versionNumber: number;
  updatedAt: string;
  createdAt: string;
  content: unknown;
  validationSummary: ValidationSummary;
  validationIssues: ValidationIssue[];
  reviewHistory: Array<{
    fromStatus?: ReviewStatus;
    toStatus?: ReviewStatus;
    actorUid?: string;
    note?: string;
    at?: string;
  }>;
}

export interface DraftGenerationResult {
  moduleVersionId: string;
  moduleId: string;
  versionNumber: number;
  status: ReviewStatus;
  validationSummary: ValidationSummary;
  validationIssues: ValidationIssue[];
  citations: Array<{
    referenceId: string;
    citation: string;
    sourceDocumentId: string;
    chunkId: string;
  }>;
  promptBundle: Record<string, string>;
}

export interface PilotMetrics {
  moduleId: string;
  classFilter: string | null;
  openEvents: number;
  iframeOpenEvents: number;
  submitEvents: number;
  submissions: number;
  uniqueOpenUsers: number;
  uniqueSubmissionUsers: number;
  completionRate: number;
  latestSubmissionAt: string;
}

export async function getClassSubmissions(
  classId: string,
  moduleId?: string
): Promise<SubmissionSummary[]> {
  const callable = httpsCallable<
    { classId: string; moduleId?: string },
    { submissions: SubmissionSummary[] }
  >(functions, "getClassSubmissions");

  const payload: { classId: string; moduleId?: string } = { classId };
  if (moduleId) {
    payload.moduleId = moduleId;
  }

  const result = await callable(payload);
  return result.data.submissions;
}

export async function exportClassCsv(
  classId: string,
  moduleId?: string
): Promise<{ csv: string; exportPath: string | null; downloadUrl: string | null }> {
  const callable = httpsCallable<
    { classId: string; moduleId?: string },
    { csv: string; exportPath: string | null; downloadUrl: string | null }
  >(functions, "exportClassCsv");

  const payload: { classId: string; moduleId?: string } = { classId };
  if (moduleId) {
    payload.moduleId = moduleId;
  }

  const result = await callable(payload);
  return result.data;
}

export async function assignUserRole(
  uid: string,
  role: "student" | "teacher" | "admin" | "editor",
  classIds: string[]
): Promise<void> {
  const callable = httpsCallable<
    { uid: string; role: "student" | "teacher" | "admin" | "editor"; classIds: string[] },
    { ok: boolean }
  >(functions, "assignUserRole");

  await callable({ uid, role, classIds });
}

export async function publishModuleVersion(moduleId: string, moduleVersionId: string): Promise<void> {
  const callable = httpsCallable<
    { moduleId: string; moduleVersionId: string },
    { ok: boolean }
  >(functions, "publishModuleVersion");

  await callable({ moduleId, moduleVersionId });
}

export async function getSubmissionDetail(submissionId: string): Promise<SubmissionDetail> {
  const callable = httpsCallable<{ submissionId: string }, { submission: SubmissionDetail }>(
    functions,
    "getSubmissionDetail"
  );

  const result = await callable({ submissionId });
  return result.data.submission;
}

export async function createStudentAccessKey(input: {
  classId: string;
  maxUses: number;
  expiresInDays: number;
  note?: string;
}): Promise<CreatedStudentAccessKey> {
  const callable = httpsCallable<
    { classId: string; maxUses: number; expiresInDays: number; note?: string },
    CreatedStudentAccessKey
  >(functions, "createStudentAccessKey");

  const result = await callable(input);
  return result.data;
}

export async function listSourceDocuments(): Promise<SourceDocumentSummary[]> {
  const callable = httpsCallable<Record<string, never>, { sources: SourceDocumentSummary[] }>(
    functions,
    "listSourceDocuments"
  );

  const result = await callable({});
  return result.data.sources;
}

export async function upsertSourceDocument(input: {
  sourceDocumentId: string;
  title: string;
  content: string;
  tags: string[];
  replaceExisting?: boolean;
}): Promise<{ sourceDocumentId: string; chunkCount: number; checksum: string; excerpt: string }> {
  const callable = httpsCallable<
    {
      sourceDocumentId: string;
      title: string;
      content: string;
      tags: string[];
      replaceExisting?: boolean;
    },
    { sourceDocumentId: string; chunkCount: number; checksum: string; excerpt: string }
  >(functions, "upsertSourceDocument");

  const result = await callable(input);
  return result.data;
}

export async function generateModuleDraft(input: {
  moduleId: string;
  title: string;
  description: string;
  outcomes: string[];
  sourceDocumentIds: string[];
}): Promise<DraftGenerationResult> {
  const callable = httpsCallable<
    {
      moduleId: string;
      title: string;
      description: string;
      outcomes: string[];
      sourceDocumentIds: string[];
    },
    DraftGenerationResult
  >(functions, "generateModuleDraft");

  const result = await callable(input);
  return result.data;
}

export async function listReviewQueue(
  statuses?: Array<"draft" | "review" | "approved">
): Promise<ReviewQueueItem[]> {
  const callable = httpsCallable<
    { statuses?: Array<"draft" | "review" | "approved"> },
    { items: ReviewQueueItem[] }
  >(functions, "listReviewQueue");

  const result = await callable(statuses ? { statuses } : {});
  return result.data.items;
}

export async function getModuleVersionDetail(moduleVersionId: string): Promise<ModuleVersionDetail> {
  const callable = httpsCallable<
    { moduleVersionId: string },
    { moduleVersion: ModuleVersionDetail }
  >(functions, "getModuleVersionDetail");

  const result = await callable({ moduleVersionId });
  return result.data.moduleVersion;
}

export async function updateModuleReviewStatus(
  moduleVersionId: string,
  nextStatus: "draft" | "review" | "approved",
  note?: string
): Promise<{ ok: boolean; moduleVersionId: string; status: "draft" | "review" | "approved" }> {
  const callable = httpsCallable<
    {
      moduleVersionId: string;
      nextStatus: "draft" | "review" | "approved";
      note?: string;
    },
    { ok: boolean; moduleVersionId: string; status: "draft" | "review" | "approved" }
  >(functions, "updateModuleReviewStatus");

  const result = await callable({ moduleVersionId, nextStatus, note });
  return result.data;
}

export async function getPilotMetrics(moduleId: string, classId?: string): Promise<PilotMetrics> {
  const callable = httpsCallable<
    { moduleId: string; classId?: string },
    { metrics: PilotMetrics }
  >(functions, "getPilotMetrics");

  const result = await callable(classId ? { moduleId, classId } : { moduleId });
  return result.data.metrics;
}
