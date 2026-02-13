import { z } from "zod";

export const SCHEMA_VERSION = "1.0.0" as const;

export const IdentifierSchema = z
  .string()
  .min(1, "Identifier is required")
  .regex(/^[a-zA-Z0-9._-]+$/, "Identifier must use [a-zA-Z0-9._-]");

const NonEmptyTextSchema = z.string().trim().min(1, "Text must not be empty");

export const RoleSchema = z.enum(["student", "teacher", "admin", "editor"]);
export type Role = z.infer<typeof RoleSchema>;

export const LegalReferenceSchema = z
  .object({
    id: IdentifierSchema,
    citation: NonEmptyTextSchema,
    url: z.string().url().optional()
  })
  .strict();

export type LegalReference = z.infer<typeof LegalReferenceSchema>;

export const TheoryBlockSchema = z
  .object({
    id: IdentifierSchema,
    type: z.literal("theory"),
    title: NonEmptyTextSchema,
    content: NonEmptyTextSchema
  })
  .strict();

const CompetenceQuestionSchema = z
  .object({
    id: IdentifierSchema,
    prompt: NonEmptyTextSchema,
    hint: z.string().optional(),
    solution: z.string().optional(),
    requiredLegalReferences: z.array(IdentifierSchema).default([])
  })
  .strict();

const RichTextPromptSchema = z
  .object({
    id: IdentifierSchema,
    prompt: NonEmptyTextSchema,
    hint: z.string().optional(),
    solution: z.string().optional(),
    requiredLegalReferences: z.array(IdentifierSchema).default([])
  })
  .strict();

export const RichTextCheckBlockSchema = z
  .object({
    id: IdentifierSchema,
    type: z.literal("rich-text-check"),
    title: NonEmptyTextSchema,
    introduction: z.string().optional(),
    prompts: z.array(RichTextPromptSchema).min(1)
  })
  .strict();

const ObjectiveItemBaseSchema = z
  .object({
    id: IdentifierSchema,
    prompt: NonEmptyTextSchema,
    hint: z.string().optional(),
    feedbackCorrect: z.string().optional(),
    feedbackIncorrect: z.string().optional(),
    explanation: z.string().optional(),
    requiredLegalReferences: z.array(IdentifierSchema).default([])
  })
  .strict();

const ObjectiveChoiceOptionSchema = z
  .object({
    id: IdentifierSchema,
    text: NonEmptyTextSchema,
    isCorrect: z.boolean()
  })
  .strict();

const ObjectiveSingleChoiceItemSchema = ObjectiveItemBaseSchema.extend({
  kind: z.literal("mc-single"),
  options: z.array(ObjectiveChoiceOptionSchema).min(2)
});

const ObjectiveMultipleChoiceItemSchema = ObjectiveItemBaseSchema.extend({
  kind: z.literal("mc-multi"),
  options: z.array(ObjectiveChoiceOptionSchema).min(2)
});

const ObjectiveTrueFalseItemSchema = ObjectiveItemBaseSchema.extend({
  kind: z.literal("true-false"),
  correctAnswer: z.boolean(),
  trueLabel: z.string().default("True"),
  falseLabel: z.string().default("False")
});

const ObjectiveMatchingPairSchema = z
  .object({
    id: IdentifierSchema,
    left: NonEmptyTextSchema,
    right: NonEmptyTextSchema
  })
  .strict();

const ObjectiveMatchingItemSchema = ObjectiveItemBaseSchema.extend({
  kind: z.literal("matching"),
  pairs: z.array(ObjectiveMatchingPairSchema).min(2),
  distractors: z.array(NonEmptyTextSchema).default([])
});

const ObjectiveOrderingOptionSchema = z
  .object({
    id: IdentifierSchema,
    text: NonEmptyTextSchema
  })
  .strict();

const ObjectiveOrderingItemSchema = ObjectiveItemBaseSchema.extend({
  kind: z.literal("ordering"),
  items: z.array(ObjectiveOrderingOptionSchema).min(3),
  correctOrder: z.array(IdentifierSchema).min(3)
});

const ObjectiveClozeBlankSchema = z
  .object({
    id: IdentifierSchema,
    label: NonEmptyTextSchema,
    answer: NonEmptyTextSchema,
    alternatives: z.array(NonEmptyTextSchema).default([])
  })
  .strict();

const ObjectiveClozeItemSchema = ObjectiveItemBaseSchema.extend({
  kind: z.literal("cloze"),
  text: NonEmptyTextSchema,
  blanks: z.array(ObjectiveClozeBlankSchema).min(1)
});

const ObjectiveItemSchema = z.discriminatedUnion("kind", [
  ObjectiveSingleChoiceItemSchema,
  ObjectiveMultipleChoiceItemSchema,
  ObjectiveTrueFalseItemSchema,
  ObjectiveMatchingItemSchema,
  ObjectiveOrderingItemSchema,
  ObjectiveClozeItemSchema
]);

export const ObjectiveCheckBlockSchema = z
  .object({
    id: IdentifierSchema,
    type: z.literal("objective-check"),
    title: NonEmptyTextSchema,
    introduction: z.string().optional(),
    items: z.array(ObjectiveItemSchema).min(1)
  })
  .strict();

export const CompetenceCheckBlockSchema = z
  .object({
    id: IdentifierSchema,
    type: z.literal("competence-check"),
    title: NonEmptyTextSchema,
    introduction: z.string().optional(),
    questions: z.array(CompetenceQuestionSchema).min(1)
  })
  .strict();

const LawCaseStepSchema = z
  .object({
    id: z.enum(["step_1", "step_2", "step_3", "step_4"]),
    title: NonEmptyTextSchema,
    prompt: NonEmptyTextSchema,
    hint: z.string().optional(),
    solution: z.string().optional()
  })
  .strict();

export const LawCaseBlockSchema = z
  .object({
    id: IdentifierSchema,
    type: z.literal("law-case-4-step"),
    title: NonEmptyTextSchema,
    caseText: NonEmptyTextSchema,
    steps: z.array(LawCaseStepSchema).length(4)
  })
  .strict();

const SolutionItemSchema = z
  .object({
    id: IdentifierSchema,
    title: NonEmptyTextSchema,
    content: NonEmptyTextSchema,
    relatedQuestionIds: z.array(IdentifierSchema).default([])
  })
  .strict();

export const SolutionUnlockBlockSchema = z
  .object({
    id: IdentifierSchema,
    type: z.literal("solution-unlock"),
    title: NonEmptyTextSchema,
    unlockMode: z.enum(["teacher-key", "role-based"]).default("role-based"),
    allowedRoles: z.array(RoleSchema).default([]),
    teacherKeyRef: IdentifierSchema.optional(),
    solutions: z.array(SolutionItemSchema).min(1)
  })
  .strict();

const DiscussionPromptSchema = z
  .object({
    id: IdentifierSchema,
    prompt: NonEmptyTextSchema
  })
  .strict();

export const DiscussionPromptBlockSchema = z
  .object({
    id: IdentifierSchema,
    type: z.literal("discussion-prompt"),
    title: NonEmptyTextSchema,
    prompts: z.array(DiscussionPromptSchema).min(1)
  })
  .strict();

export const MindmapBlockSchema = z
  .object({
    id: IdentifierSchema,
    type: z.literal("mindmap"),
    title: NonEmptyTextSchema,
    content: NonEmptyTextSchema
  })
  .strict();

export type MindmapBlock = z.infer<typeof MindmapBlockSchema>;

export const ModuleBlockSchema = z.discriminatedUnion("type", [
  TheoryBlockSchema,
  RichTextCheckBlockSchema,
  CompetenceCheckBlockSchema,
  ObjectiveCheckBlockSchema,
  LawCaseBlockSchema,
  SolutionUnlockBlockSchema,
  DiscussionPromptBlockSchema,
  MindmapBlockSchema
]);

export type ModuleBlock = z.infer<typeof ModuleBlockSchema>;

export const PageTypeSchema = z.enum(["theory", "summary", "cases", "mindmap"]);
export type PageType = z.infer<typeof PageTypeSchema>;

export const LessonSchema = z
  .object({
    lessonId: IdentifierSchema,
    title: NonEmptyTextSchema,
    pageType: PageTypeSchema.optional(),
    blocks: z.array(ModuleBlockSchema).min(1)
  })
  .strict();

export type Lesson = z.infer<typeof LessonSchema>;

export const ModuleVersionSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    moduleId: IdentifierSchema,
    title: NonEmptyTextSchema,
    description: NonEmptyTextSchema,
    outcomes: z.array(NonEmptyTextSchema).min(1),
    version: z.number().int().positive(),
    status: z.enum(["draft", "review", "approved", "published"]),
    legalReferences: z.array(LegalReferenceSchema).default([]),
    metadata: z
      .object({
        language: z.string().default("de-CH"),
        estimatedMinutes: z.number().int().positive().optional()
      })
      .default({ language: "de-CH" }),
    generation: z
      .object({
        sourceDocumentIds: z.array(z.string()).default([]),
        generatedBy: z.string().optional(),
        generatedAt: z.string().datetime({ offset: true }).optional()
      })
      .optional(),
    lessons: z.array(LessonSchema).min(1)
  })
  .strict();

export type ModuleVersion = z.infer<typeof ModuleVersionSchema>;

export const CourseSubtopicSchema = z
  .object({
    order: z.number().int().positive(),
    moduleId: IdentifierSchema,
    title: NonEmptyTextSchema
  })
  .strict();

export const CourseSchema = z
  .object({
    courseId: IdentifierSchema,
    title: NonEmptyTextSchema,
    description: NonEmptyTextSchema,
    subtopics: z.array(CourseSubtopicSchema).min(1)
  })
  .strict();

export type Course = z.infer<typeof CourseSchema>;
export type CourseSubtopic = z.infer<typeof CourseSubtopicSchema>;
