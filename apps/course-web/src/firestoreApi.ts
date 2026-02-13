import { httpsCallable } from "firebase/functions";
import type { AttemptAnswers } from "@hfp/content-renderer";
import { functions } from "./firebase";

export interface SaveAttemptInput {
  moduleId: string;
  moduleVersionId: string;
  classId: string;
  answers: AttemptAnswers;
}

export type SubmitModuleInput = SaveAttemptInput;

export interface SubmissionSummary {
  submissionId: string;
  ownerUid: string;
  moduleId: string;
  moduleVersionId: string;
  classId: string;
  submittedAt: string;
}

export interface AttemptSnapshot {
  attemptId: string;
  ownerUid: string;
  classId: string;
  moduleId: string;
  moduleVersionId: string;
  status: string;
  answers: AttemptAnswers;
  updatedAt: string;
  submittedAt: string;
}

export interface RegisterStudentInput {
  email: string;
  password: string;
  accessKey: string;
  displayName?: string;
}

export interface SessionEventInput {
  moduleId: string;
  moduleVersionId?: string;
  classId?: string;
  eventType: "module_open" | "embed_open" | "module_submit" | "module_complete";
  origin?: string;
}

export async function getPublishedModule(moduleId: string): Promise<unknown> {
  const callable = httpsCallable<{ moduleId: string }, { module: unknown }>(
    functions,
    "getPublishedModule"
  );
  const result = await callable({ moduleId });
  return result.data.module;
}

export async function saveAttempt(input: SaveAttemptInput): Promise<void> {
  const callable = httpsCallable<SaveAttemptInput, { attemptId: string }>(functions, "saveAttempt");
  await callable(input);
}

export async function getMyAttempt(
  moduleId: string,
  moduleVersionId: string
): Promise<AttemptSnapshot | null> {
  const callable = httpsCallable<
    { moduleId: string; moduleVersionId: string },
    { attempt: AttemptSnapshot | null }
  >(functions, "getMyAttempt");

  const result = await callable({ moduleId, moduleVersionId });
  return result.data.attempt;
}

export async function submitModule(input: SubmitModuleInput): Promise<string> {
  const callable = httpsCallable<SubmitModuleInput, { submissionId: string }>(
    functions,
    "submitModule"
  );
  const result = await callable(input);
  return result.data.submissionId;
}

export async function getMySubmissions(moduleId?: string): Promise<SubmissionSummary[]> {
  const callable = httpsCallable<{ moduleId?: string }, { submissions: SubmissionSummary[] }>(
    functions,
    "getMySubmissions"
  );

  const payload: { moduleId?: string } = {};
  if (moduleId) {
    payload.moduleId = moduleId;
  }

  const result = await callable(payload);
  return result.data.submissions;
}

export async function registerStudentWithAccessKey(input: RegisterStudentInput): Promise<void> {
  const callable = httpsCallable<RegisterStudentInput, { uid: string; role: string; classId: string }>(
    functions,
    "registerStudentWithAccessKey"
  );

  await callable(input);
}

export async function trackSessionEvent(input: SessionEventInput): Promise<void> {
  const callable = httpsCallable<SessionEventInput, { ok: boolean }>(functions, "trackSessionEvent");
  await callable(input);
}
