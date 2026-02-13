import { createHash } from "node:crypto";
import {
  PROMPT_CONTRACT_VERSION,
  buildPromptBundle,
  type PromptTemplateId
} from "@hfp/prompt-engine";
import { z } from "zod";

const IDENTIFIER_REGEX = /^[a-zA-Z0-9._-]+$/;

const IdentifierSchema = z
  .string()
  .min(1, "Identifier is required")
  .regex(IDENTIFIER_REGEX, "Identifier must use [a-zA-Z0-9._-]");

const NonEmptyTextSchema = z.string().trim().min(1, "Text must not be empty");

const LegalReferenceSchema = z
  .object({
    id: IdentifierSchema,
    citation: NonEmptyTextSchema,
    url: z.string().url().optional()
  })
  .strict();

const CompetenceQuestionSchema = z
  .object({
    id: IdentifierSchema,
    prompt: NonEmptyTextSchema,
    hint: z.string().optional(),
    solution: z.string().optional(),
    requiredLegalReferences: z.array(IdentifierSchema).min(1)
  })
  .strict();

const ModuleBlockSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: IdentifierSchema,
      type: z.literal("theory"),
      title: NonEmptyTextSchema,
      content: NonEmptyTextSchema
    })
    .strict(),
  z
    .object({
      id: IdentifierSchema,
      type: z.literal("competence-check"),
      title: NonEmptyTextSchema,
      introduction: z.string().optional(),
      questions: z.array(CompetenceQuestionSchema).min(1)
    })
    .strict(),
  z
    .object({
      id: IdentifierSchema,
      type: z.literal("law-case-4-step"),
      title: NonEmptyTextSchema,
      caseText: NonEmptyTextSchema,
      steps: z
        .array(
          z
            .object({
              id: z.enum(["step_1", "step_2", "step_3", "step_4"]),
              title: NonEmptyTextSchema,
              prompt: NonEmptyTextSchema,
              hint: z.string().optional(),
              solution: z.string().optional()
            })
            .strict()
        )
        .length(4)
    })
    .strict(),
  z
    .object({
      id: IdentifierSchema,
      type: z.literal("solution-unlock"),
      title: NonEmptyTextSchema,
      unlockMode: z.enum(["teacher-key", "role-based"]),
      allowedRoles: z.array(z.enum(["student", "teacher", "admin", "editor"])),
      teacherKeyRef: IdentifierSchema.optional(),
      solutions: z
        .array(
          z
            .object({
              id: IdentifierSchema,
              title: NonEmptyTextSchema,
              content: NonEmptyTextSchema,
              relatedQuestionIds: z.array(IdentifierSchema)
            })
            .strict()
        )
        .min(1)
    })
    .strict(),
  z
    .object({
      id: IdentifierSchema,
      type: z.literal("discussion-prompt"),
      title: NonEmptyTextSchema,
      prompts: z
        .array(
          z
            .object({
              id: IdentifierSchema,
              prompt: NonEmptyTextSchema
            })
            .strict()
        )
        .min(1)
    })
    .strict()
]);

const ModuleVersionSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    moduleId: IdentifierSchema,
    title: NonEmptyTextSchema,
    description: NonEmptyTextSchema,
    outcomes: z.array(NonEmptyTextSchema).min(1),
    version: z.number().int().positive(),
    status: z.enum(["draft", "review", "approved", "published"]),
    legalReferences: z.array(LegalReferenceSchema),
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
    lessons: z
      .array(
        z
          .object({
            lessonId: IdentifierSchema,
            title: NonEmptyTextSchema,
            blocks: z.array(ModuleBlockSchema).min(1)
          })
          .strict()
      )
      .min(1)
  })
  .strict();

export type GeneratedModuleVersion = z.infer<typeof ModuleVersionSchema>;

export type PipelineSeverity = "error" | "warning";

export interface PipelineIssue {
  code: string;
  path: string;
  message: string;
  severity: PipelineSeverity;
}

export interface ValidationSummary {
  errorCount: number;
  warningCount: number;
}

export interface SourceDocumentRecord {
  sourceDocumentId: string;
  title: string;
  content: string;
  tags: string[];
  chunkCount?: number;
}

export interface SourceChunk {
  chunkId: string;
  chunkIndex: number;
  text: string;
  tokenEstimate: number;
}

export interface CitationLink {
  referenceId: string;
  citation: string;
  sourceDocumentId: string;
  chunkId: string;
}

export interface DraftBuildInput {
  moduleId: string;
  title: string;
  description: string;
  outcomes: string[];
  sourceDocuments: SourceDocumentRecord[];
  version: number;
  generatedBy?: string;
  generatedAt?: string;
}

export interface DraftBuildResult {
  module: GeneratedModuleVersion;
  issues: PipelineIssue[];
  validationSummary: ValidationSummary;
  promptBundle: Record<PromptTemplateId, string>;
  citations: CitationLink[];
}

interface PromptSourceSnippet {
  sourceDocumentId: string;
  title: string;
  excerpt: string;
}

const LEGAL_REFERENCE_PATTERNS: Array<{ law: string; regex: RegExp }> = [
  { law: "OR", regex: /\bOR\s*Art\.?\s*(\d+[a-zA-Z]*)/g },
  { law: "ZGB", regex: /\bZGB\s*Art\.?\s*(\d+[a-zA-Z]*)/g },
  { law: "BV", regex: /\bBV\s*Art\.?\s*(\d+[a-zA-Z]*)/g },
  { law: "SchKG", regex: /\bSchKG\s*Art\.?\s*(\d+[a-zA-Z]*)/g },
  { law: "USG", regex: /\bUSG\s*Art\.?\s*(\d+[a-zA-Z]*)/g },
  { law: "SVG", regex: /\bSVG\s*Art\.?\s*(\d+[a-zA-Z]*)/g }
];

const STOP_WORDS = new Set([
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "und",
  "oder",
  "ist",
  "sind",
  "im",
  "in",
  "auf",
  "von",
  "mit",
  "fuer",
  "zum",
  "zur",
  "nicht",
  "kein",
  "keine",
  "ohne"
]);

export function createSourceChecksum(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function normalizeSourceText(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function buildSourceExcerpt(input: string, maxLength = 280): string {
  const normalized = normalizeSourceText(stripMarkdownNoise(input));
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

export function chunkSourceText(input: string, chunkSize = 850, overlap = 110): SourceChunk[] {
  const normalized = normalizeSourceText(stripMarkdownNoise(input));
  if (!normalized) {
    return [];
  }

  const tokens = normalized.split(/\s+/).filter((token) => token.length > 0);
  const chunks: SourceChunk[] = [];
  let cursor = 0;

  while (cursor < tokens.length) {
    const end = Math.min(cursor + chunkSize, tokens.length);
    const slice = tokens.slice(cursor, end);
    const text = slice.join(" ");

    chunks.push({
      chunkId: `chunk_${String(chunks.length + 1).padStart(3, "0")}`,
      chunkIndex: chunks.length,
      text,
      tokenEstimate: slice.length
    });

    if (end >= tokens.length) {
      break;
    }

    cursor = Math.max(end - overlap, cursor + 1);
  }

  return chunks;
}

export function buildGeneratedDraft(input: DraftBuildInput): DraftBuildResult {
  const sourceSnippets = input.sourceDocuments.map<PromptSourceSnippet>((document) => ({
    sourceDocumentId: document.sourceDocumentId,
    title: document.title,
    excerpt: buildSourceExcerpt(document.content, 260)
  }));

  const promptBundle = buildPromptBundle({
    moduleId: input.moduleId,
    moduleTitle: input.title,
    moduleDescription: input.description,
    outcomes: input.outcomes,
    sourceDocuments: sourceSnippets
  });

  const legalReferences = extractLegalReferences(input.sourceDocuments);
  const learningOutcomes = sanitizeOutcomes(input.outcomes);
  const theoryParagraphs = buildTheoryParagraphs(input.sourceDocuments, learningOutcomes);
  const competenceQuestions = buildCompetenceQuestions(learningOutcomes, legalReferences, input.sourceDocuments);
  const lawCase = buildLawCase(input.sourceDocuments, legalReferences);
  const discussionPrompts = buildDiscussionPrompts(learningOutcomes);
  const solutionItems = buildSolutionItems(competenceQuestions, lawCase.steps);
  const citations = buildCitationLinks(legalReferences, input.sourceDocuments);

  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const module: GeneratedModuleVersion = {
    schemaVersion: "1.0.0",
    moduleId: sanitizeIdentifier(input.moduleId, "module"),
    title: input.title.trim(),
    description: input.description.trim(),
    outcomes: learningOutcomes,
    version: input.version,
    status: "draft",
    legalReferences,
    metadata: {
      language: "de-CH",
      estimatedMinutes: estimateMinutes(theoryParagraphs, competenceQuestions.length)
    },
    generation: {
      sourceDocumentIds: input.sourceDocuments.map((document) => document.sourceDocumentId),
      generatedBy: input.generatedBy ?? "prompt-engine-fallback",
      generatedAt,
      promptContractVersion: PROMPT_CONTRACT_VERSION,
      promptBundle,
      citations
    } as GeneratedModuleVersion["generation"],
    lessons: [
      {
        lessonId: "lesson_1",
        title: "Theorie und Begriffe",
        blocks: [
          {
            id: "theory_1",
            type: "theory",
            title: "Rechtliche Grundlagen",
            content: theoryParagraphs.join("\n\n")
          },
          {
            id: "check_1",
            type: "competence-check",
            title: "Kompetenzcheck",
            introduction: "Beantworten Sie die Fragen klar und mit Bezug auf die Rechtsgrundlagen.",
            questions: competenceQuestions
          }
        ]
      },
      {
        lessonId: "lesson_2",
        title: "Fallanalyse und Transfer",
        blocks: [
          lawCase,
          {
            id: "solution_1",
            type: "solution-unlock",
            title: "Musterloesungen",
            unlockMode: "role-based",
            allowedRoles: ["teacher", "admin", "editor"],
            solutions: solutionItems
          },
          {
            id: "discussion_1",
            type: "discussion-prompt",
            title: "Reflexion",
            prompts: discussionPrompts
          }
        ]
      }
    ]
  };

  const issues = validateGeneratedDraft(module);
  const validationSummary = summarizeIssues(issues);

  return {
    module,
    issues,
    validationSummary,
    promptBundle,
    citations
  };
}

export function validateGeneratedDraft(module: GeneratedModuleVersion): PipelineIssue[] {
  const issues: PipelineIssue[] = [];

  const parsed = ModuleVersionSchema.safeParse(module);
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => {
      issues.push({
        code: "schema_error",
        path: issue.path.length > 0 ? issue.path.join(".") : "root",
        message: issue.message,
        severity: "error"
      });
    });
    return issues;
  }

  const legalRefs = new Set(module.legalReferences.map((reference) => reference.id));
  const blockIds = new Set<string>();
  const questionIds = new Set<string>();
  const inlineSolutionIds = new Set<string>();
  const relatedSolutionIds = new Set<string>();
  const duplicatedPrompts = new Set<string>();
  const promptMap = new Map<string, string>();
  const solutionMap = new Map<string, string>();
  const contradictionPool: Array<{ id: string; text: string }> = [];

  module.lessons.forEach((lesson, lessonIndex) => {
    lesson.blocks.forEach((block, blockIndex) => {
      const blockPath = `lessons.${lessonIndex}.blocks.${blockIndex}`;

      if (blockIds.has(block.id)) {
        issues.push({
          code: "duplicate_block_id",
          path: `${blockPath}.id`,
          message: `Duplicate block id '${block.id}'.`,
          severity: "error"
        });
      }
      blockIds.add(block.id);

      if (block.type === "competence-check") {
        block.questions.forEach((question, questionIndex) => {
          const questionPath = `${blockPath}.questions.${questionIndex}`;
          if (questionIds.has(question.id)) {
            issues.push({
              code: "duplicate_question_id",
              path: `${questionPath}.id`,
              message: `Duplicate question id '${question.id}'.`,
              severity: "error"
            });
          }
          questionIds.add(question.id);

          if (!question.requiredLegalReferences || question.requiredLegalReferences.length === 0) {
            issues.push({
              code: "missing_required_legal_reference",
              path: `${questionPath}.requiredLegalReferences`,
              message: `Question '${question.id}' has no required legal references.`,
              severity: "error"
            });
          }

          question.requiredLegalReferences.forEach((referenceId) => {
            if (!legalRefs.has(referenceId)) {
              issues.push({
                code: "unknown_legal_reference",
                path: `${questionPath}.requiredLegalReferences`,
                message: `Question '${question.id}' references unknown legal id '${referenceId}'.`,
                severity: "error"
              });
            }
          });

          if (typeof question.solution === "string" && question.solution.trim().length > 0) {
            inlineSolutionIds.add(question.id);
            contradictionPool.push({ id: question.id, text: question.solution });
          }

          const normalizedPrompt = normalizeText(question.prompt);
          const seenPromptId = promptMap.get(normalizedPrompt);
          if (seenPromptId && !duplicatedPrompts.has(normalizedPrompt)) {
            duplicatedPrompts.add(normalizedPrompt);
            issues.push({
              code: "duplicate_prompt",
              path: `${questionPath}.prompt`,
              message: `Potential duplicate prompt between '${seenPromptId}' and '${question.id}'.`,
              severity: "warning"
            });
          }
          promptMap.set(normalizedPrompt, question.id);
        });
      }

      if (block.type === "law-case-4-step") {
        const stepIds = block.steps.map((step) => step.id);
        const expected = ["step_1", "step_2", "step_3", "step_4"];
        if (JSON.stringify(stepIds) !== JSON.stringify(expected)) {
          issues.push({
            code: "step_order_invalid",
            path: `${blockPath}.steps`,
            message: "Law-case steps must be ordered step_1..step_4.",
            severity: "error"
          });
        }

        block.steps.forEach((step, stepIndex) => {
          const stepPath = `${blockPath}.steps.${stepIndex}`;
          if (questionIds.has(step.id)) {
            issues.push({
              code: "duplicate_step_id",
              path: `${stepPath}.id`,
              message: `Duplicate step id '${step.id}' collides with another question id.`,
              severity: "error"
            });
          }
          questionIds.add(step.id);

          if (typeof step.solution === "string" && step.solution.trim().length > 0) {
            inlineSolutionIds.add(step.id);
            contradictionPool.push({ id: step.id, text: step.solution });
          }
        });
      }

      if (block.type === "solution-unlock") {
        block.solutions.forEach((solution, solutionIndex) => {
          const solutionPath = `${blockPath}.solutions.${solutionIndex}`;
          const normalizedSolution = normalizeText(solution.content);
          const seenSolutionId = solutionMap.get(normalizedSolution);
          if (seenSolutionId) {
            issues.push({
              code: "duplicate_solution_text",
              path: `${solutionPath}.content`,
              message: `Potential duplicate solution content between '${seenSolutionId}' and '${solution.id}'.`,
              severity: "warning"
            });
          }
          solutionMap.set(normalizedSolution, solution.id);

          contradictionPool.push({ id: solution.id, text: solution.content });

          solution.relatedQuestionIds.forEach((questionId) => {
            relatedSolutionIds.add(questionId);
          });
        });
      }
    });
  });

  questionIds.forEach((questionId) => {
    if (!inlineSolutionIds.has(questionId) && !relatedSolutionIds.has(questionId)) {
      issues.push({
        code: "question_without_solution_coverage",
        path: "lessons",
        message: `Question '${questionId}' has no mapped solution coverage.`,
        severity: "error"
      });
    }
  });

  relatedSolutionIds.forEach((questionId) => {
    if (!questionIds.has(questionId)) {
      issues.push({
        code: "solution_related_question_unknown",
        path: "lessons",
        message: `Solution references unknown question id '${questionId}'.`,
        severity: "warning"
      });
    }
  });

  issues.push(...detectContradictions(contradictionPool));

  return issues;
}

export function summarizeIssues(issues: PipelineIssue[]): ValidationSummary {
  return {
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length
  };
}

function sanitizeOutcomes(outcomes: string[]): string[] {
  const normalized = outcomes
    .map((outcome) => normalizeSentence(outcome))
    .filter((outcome) => outcome.length > 0);

  if (normalized.length > 0) {
    return Array.from(new Set(normalized));
  }

  return [
    "Die Lernenden analysieren Rechtsfragen strukturiert.",
    "Die Lernenden begruenden Loesungen mit gesetzlichen Grundlagen.",
    "Die Lernenden uebertragen Erkenntnisse auf Werkstattfaelle."
  ];
}

function buildTheoryParagraphs(sourceDocuments: SourceDocumentRecord[], outcomes: string[]): string[] {
  const snippets = sourceDocuments
    .slice(0, 3)
    .map((document) => buildSourceExcerpt(document.content, 420))
    .filter((snippet) => snippet.length > 0);

  if (snippets.length === 0) {
    return [
      "Dieses Modul fuehrt in zentrale Rechtsgrundlagen ein und verbindet Theorie mit praxisnahen Faellen.",
      "Die Lernziele fokussieren auf Konsens, Formvorschriften, Handlungsfaehigkeit und Rechtsfolgen im Werkstattalltag."
    ];
  }

  const outcomeLine = `Lernfokus: ${outcomes.join(" ")}`;
  return [snippets[0], snippets[1] ?? outcomeLine, outcomeLine];
}

function buildCompetenceQuestions(
  outcomes: string[],
  legalReferences: Array<{ id: string; citation: string }>,
  sourceDocuments: SourceDocumentRecord[]
): Array<{
  id: string;
  prompt: string;
  hint: string;
  solution: string;
  requiredLegalReferences: string[];
}> {
  const fallbackPrompts = outcomes.map((outcome) =>
    normalizeSentence(
      `Erklaeren Sie in eigenen Worten, wie folgendes Lernziel im Werkstattkontext angewendet wird: ${outcome}`
    )
  );

  const extractedPrompts = extractPromptCandidates(sourceDocuments)
    .map((prompt) => normalizeSentence(prompt))
    .filter((prompt) => prompt.length > 30)
    .slice(0, 4);

  const allPrompts = Array.from(new Set([...extractedPrompts, ...fallbackPrompts])).slice(0, 4);
  const referenceIds = legalReferences.map((reference) => reference.id);

  return allPrompts.map((prompt, index) => {
    const refId = referenceIds[index % Math.max(1, referenceIds.length)] ?? "or-art-1";
    return {
      id: `q_${String(index + 1).padStart(2, "0")}`,
      prompt,
      hint: `Beziehen Sie sich auf ${refId.replace(/-/g, " ").toUpperCase()} und den konkreten Fallkontext.`,
      solution: `Eine gute Antwort stellt den Sachverhalt klar dar, nennt ${refId.toUpperCase()} und begruendet die Rechtsfolge nachvollziehbar.`,
      requiredLegalReferences: [refId]
    };
  });
}

function buildLawCase(
  sourceDocuments: SourceDocumentRecord[],
  legalReferences: Array<{ id: string; citation: string }>
): {
  id: string;
  type: "law-case-4-step";
  title: string;
  caseText: string;
  steps: Array<{
    id: "step_1" | "step_2" | "step_3" | "step_4";
    title: string;
    prompt: string;
    hint: string;
    solution: string;
  }>;
} {
  const caseText =
    sourceDocuments
      .map((document) => findCaseSnippet(document.content))
      .find((snippet) => snippet.length > 0) ??
    "Ein Werkstattleiter erhaelt widerspruechliche Hinweise aus Gesetz, Verordnung und einer behordlichen Verfuegung. Er muss entscheiden, welche Norm gilt und wie er gegenueber Kunden korrekt handelt.";

  const primaryRef = legalReferences[0]?.citation ?? "OR Art. 1";
  const secondaryRef = legalReferences[1]?.citation ?? "ZGB Art. 1";

  return {
    id: "lawcase_1",
    type: "law-case-4-step",
    title: "Fallanalyse: Konflikt zwischen Rechtsquellen",
    caseText,
    steps: [
      {
        id: "step_1",
        title: "Sachverhalt erfassen",
        prompt: "Welche Akteure, Ansprueche und Konfliktpunkte sind im Fall zentral?",
        hint: "Trennen Sie Fakten von Wertungen und listen Sie die Beteiligten mit ihren Rollen auf.",
        solution: "Die Antwort nennt die Beteiligten, ordnet deren Rollen und formuliert die zentrale Rechtsfrage ohne Vorwegnahme der Loesung."
      },
      {
        id: "step_2",
        title: "Rechtsgrundlagen bestimmen",
        prompt: "Welche Normen sind einschlaegig und in welcher Hierarchie stehen sie?",
        hint: `Pruefen Sie mindestens ${primaryRef} und ${secondaryRef}.`,
        solution: "Die Antwort identifiziert die relevanten Normen und begruendet deren Rangfolge transparent."
      },
      {
        id: "step_3",
        title: "Tatbestandsmerkmale pruefen",
        prompt: "Welche Voraussetzungen muessen erfuellt sein und welche Belege sprechen dafuer oder dagegen?",
        hint: "Arbeiten Sie mit einer klaren Wenn-dann-Struktur pro Voraussetzung.",
        solution: "Die Antwort ordnet jedem Tatbestandsmerkmal konkrete Sachverhaltselemente zu und dokumentiert Unsicherheiten."
      },
      {
        id: "step_4",
        title: "Rechtsfolge ableiten",
        prompt: "Welche begruendete Entscheidung folgt fuer den Betrieb und wie sollte sie kommuniziert werden?",
        hint: "Nennen Sie die Rechtsfolge und eine praxisnahe Handlungsempfehlung.",
        solution: "Die Antwort verbindet die Normpruefung mit einer klaren Rechtsfolge und leitet ein umsetzbares Vorgehen fuer den Werkstattalltag ab."
      }
    ]
  };
}

function buildSolutionItems(
  competenceQuestions: Array<{ id: string; prompt: string; solution: string }>,
  lawSteps: Array<{ id: "step_1" | "step_2" | "step_3" | "step_4"; solution: string }>
): Array<{ id: string; title: string; content: string; relatedQuestionIds: string[] }> {
  const questionSolutions = competenceQuestions.map((question, index) => ({
    id: `sol_q_${String(index + 1).padStart(2, "0")}`,
    title: `Musterloesung Frage ${index + 1}`,
    content: question.solution,
    relatedQuestionIds: [question.id]
  }));

  const stepSolutions = lawSteps.map((step) => ({
    id: `sol_${step.id}`,
    title: `Musterloesung ${step.id.replace("_", " ")}`,
    content: step.solution,
    relatedQuestionIds: [step.id]
  }));

  return [...questionSolutions, ...stepSolutions];
}

function buildDiscussionPrompts(outcomes: string[]): Array<{ id: string; prompt: string }> {
  const prompts = outcomes.slice(0, 2).map((outcome, index) => ({
    id: `d_${index + 1}`,
    prompt: `Wie zeigt sich folgendes Lernziel in Ihrem Betrieb: ${outcome}`
  }));

  prompts.push({
    id: `d_${prompts.length + 1}`,
    prompt: "Welche Massnahmen helfen, rechtliche Aenderungen im Werkstattalltag fruehzeitig umzusetzen?"
  });

  return prompts;
}

function buildCitationLinks(
  legalReferences: Array<{ id: string; citation: string }>,
  sourceDocuments: SourceDocumentRecord[]
): CitationLink[] {
  return legalReferences.map((reference, index) => {
    const sourceDocument = sourceDocuments[index % Math.max(1, sourceDocuments.length)];
    return {
      referenceId: reference.id,
      citation: reference.citation,
      sourceDocumentId: sourceDocument?.sourceDocumentId ?? "unknown-source",
      chunkId: `chunk_${String((index % 4) + 1).padStart(3, "0")}`
    };
  });
}

function extractLegalReferences(
  sourceDocuments: SourceDocumentRecord[]
): Array<{ id: string; citation: string; url?: string }> {
  const references = new Map<string, { id: string; citation: string }>();

  sourceDocuments.forEach((document) => {
    LEGAL_REFERENCE_PATTERNS.forEach(({ law, regex }) => {
      regex.lastIndex = 0;
      let match = regex.exec(document.content);
      while (match) {
        const article = match[1];
        const id = `${law.toLowerCase()}-art-${article.toLowerCase()}`;
        const citation = `${law} Art. ${article}`;
        if (!references.has(id)) {
          references.set(id, { id, citation });
        }
        match = regex.exec(document.content);
      }
    });
  });

  if (references.size === 0) {
    references.set("or-art-1", { id: "or-art-1", citation: "OR Art. 1" });
    references.set("or-art-11", { id: "or-art-11", citation: "OR Art. 11" });
    references.set("zgb-art-1", { id: "zgb-art-1", citation: "ZGB Art. 1" });
  }

  return Array.from(references.values()).slice(0, 12);
}

function extractPromptCandidates(sourceDocuments: SourceDocumentRecord[]): string[] {
  const candidates: string[] = [];

  sourceDocuments.forEach((document) => {
    const normalized = normalizeSourceText(stripMarkdownNoise(document.content));
    normalized
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 45 && sentence.length <= 220)
      .slice(0, 6)
      .forEach((sentence) => {
        candidates.push(sentence);
      });
  });

  return candidates;
}

function findCaseSnippet(input: string): string {
  const normalized = normalizeSourceText(stripMarkdownNoise(input));
  const caseLike = normalized
    .split(/(?<=[.!?])\s+/)
    .find((sentence) => /fall|werkstatt|kunde|behoerde|vertrag|gesetz/i.test(sentence));

  if (!caseLike) {
    return "";
  }

  return caseLike.length > 360 ? `${caseLike.slice(0, 357)}...` : caseLike;
}

function detectContradictions(entries: Array<{ id: string; text: string }>): PipelineIssue[] {
  const issues: PipelineIssue[] = [];
  const fingerprints = new Map<string, Array<{ id: string; negated: boolean }>>();

  entries.forEach((entry) => {
    const normalized = normalizeText(entry.text);
    if (!normalized) {
      return;
    }

    const negated = /\b(nicht|kein|keine|ohne|verboten|unzulaessig)\b/i.test(normalized);
    const core = normalizeCore(normalized);
    if (!core) {
      return;
    }

    const bucket = fingerprints.get(core) ?? [];
    bucket.push({ id: entry.id, negated });
    fingerprints.set(core, bucket);
  });

  fingerprints.forEach((bucket, core) => {
    const hasNegated = bucket.some((entry) => entry.negated);
    const hasPositive = bucket.some((entry) => !entry.negated);

    if (!hasNegated || !hasPositive || bucket.length < 2) {
      return;
    }

    const relatedIds = bucket.map((entry) => entry.id).join(", ");
    issues.push({
      code: "potential_contradiction",
      path: "lessons",
      message: `Potential contradiction detected for statements with similar core '${core}' (${relatedIds}).`,
      severity: "warning"
    });
  });

  return issues;
}

function sanitizeIdentifier(input: string, fallbackPrefix: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (normalized.length > 0) {
    return normalized;
  }

  return `${fallbackPrefix}-${Date.now()}`;
}

function sanitizeSentence(input: string): string {
  return normalizeWhitespace(stripMarkdownNoise(input))
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function stripMarkdownNoise(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\[!\w+\]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_-]{1,}/g, " ");
}

function normalizeText(input: string): string {
  return normalizeWhitespace(
    input
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .trim()
  );
}

function normalizeCore(input: string): string {
  return input
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
    .slice(0, 8)
    .join(" ");
}

function normalizeSentence(input: string): string {
  const cleaned = sanitizeSentence(input);
  if (!cleaned) {
    return "";
  }
  if (/[.!?]$/.test(cleaned)) {
    return cleaned;
  }
  return `${cleaned}.`;
}

function estimateMinutes(theoryParagraphs: string[], questionCount: number): number {
  const readingWords = theoryParagraphs
    .join(" ")
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  const readingMinutes = Math.max(10, Math.ceil(readingWords / 130));
  const writingMinutes = questionCount * 5;
  return Math.min(120, readingMinutes + writingMinutes + 10);
}
