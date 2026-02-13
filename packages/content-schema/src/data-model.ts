import { z } from "zod";
import { IdentifierSchema, RoleSchema } from "./schema";

const IsoDateSchema = z.string().datetime({ offset: true });

export const AttemptAnswerValueSchema = z.union([
  z.string(),
  z.record(z.string(), z.string())
]);

export const AttemptSchema = z
  .object({
    attemptId: IdentifierSchema,
    ownerUid: z.string().min(1),
    classId: IdentifierSchema,
    moduleId: IdentifierSchema,
    moduleVersionId: IdentifierSchema,
    status: z.enum(["draft", "submitted"]),
    answers: z.record(z.string(), AttemptAnswerValueSchema),
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema,
    submittedAt: IsoDateSchema.optional()
  })
  .strict();

export type Attempt = z.infer<typeof AttemptSchema>;

export const SubmissionSchema = z
  .object({
    submissionId: IdentifierSchema,
    ownerUid: z.string().min(1),
    classId: IdentifierSchema,
    moduleId: IdentifierSchema,
    moduleVersionId: IdentifierSchema,
    attemptId: IdentifierSchema,
    answers: z.record(z.string(), AttemptAnswerValueSchema),
    submittedAt: IsoDateSchema
  })
  .strict();

export type Submission = z.infer<typeof SubmissionSchema>;

export const UserProfileSchema = z
  .object({
    uid: z.string().min(1),
    role: RoleSchema,
    classIds: z.array(IdentifierSchema).default([]),
    displayName: z.string().optional()
  })
  .strict();

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const ClassSchema = z
  .object({
    classId: IdentifierSchema,
    title: z.string().min(1),
    teacherUids: z.array(z.string().min(1)).default([])
  })
  .strict();

export type Class = z.infer<typeof ClassSchema>;
