import { ZodError } from "zod";
import { ModuleVersionSchema, type ModuleVersion, type ModuleBlock } from "./schema";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  path: string;
  message: string;
  severity: ValidationSeverity;
}

export function formatZodError(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "root",
    message: issue.message,
    severity: "error"
  }));
}

export function parseModuleVersion(input: unknown): ModuleVersion {
  const result = ModuleVersionSchema.safeParse(input);
  if (!result.success) {
    const formatted = formatZodError(result.error);
    const message = formatted
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("; ");
    throw new Error(`Module validation failed: ${message}`);
  }
  return result.data;
}

export function safeParseModuleVersion(input: unknown):
  | { success: true; data: ModuleVersion }
  | { success: false; issues: ValidationIssue[] } {
  const result = ModuleVersionSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      issues: formatZodError(result.error)
    };
  }

  return {
    success: true,
    data: result.data
  };
}

export function validateModuleSemantics(module: ModuleVersion): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const legalRefs = new Set(module.legalReferences.map((item) => item.id));
  const blockIds = new Set<string>();
  const questionIds = new Set<string>();

  module.lessons.forEach((lesson, lessonIndex) => {
    lesson.blocks.forEach((block, blockIndex) => {
      const blockPath = `lessons.${lessonIndex}.blocks.${blockIndex}`;

      if (blockIds.has(block.id)) {
        issues.push({
          path: `${blockPath}.id`,
          message: `Duplicate block id '${block.id}'`,
          severity: "error"
        });
      }

      blockIds.add(block.id);
      registerQuestionIds(block, questionIds, issues, blockPath);

      if (block.type === "competence-check") {
        block.questions.forEach((question, questionIndex) => {
          question.requiredLegalReferences.forEach((referenceId) => {
            if (!legalRefs.has(referenceId)) {
              issues.push({
                path: `${blockPath}.questions.${questionIndex}.requiredLegalReferences`,
                message: `Unknown legal reference '${referenceId}'`,
                severity: "error"
              });
            }
          });
        });
      }

      if (block.type === "rich-text-check") {
        block.prompts.forEach((prompt, promptIndex) => {
          prompt.requiredLegalReferences.forEach((referenceId) => {
            if (!legalRefs.has(referenceId)) {
              issues.push({
                path: `${blockPath}.prompts.${promptIndex}.requiredLegalReferences`,
                message: `Unknown legal reference '${referenceId}'`,
                severity: "error"
              });
            }
          });
        });
      }

      if (block.type === "objective-check") {
        block.items.forEach((item, itemIndex) => {
          item.requiredLegalReferences.forEach((referenceId: string) => {
            if (!legalRefs.has(referenceId)) {
              issues.push({
                path: `${blockPath}.items.${itemIndex}.requiredLegalReferences`,
                message: `Unknown legal reference '${referenceId}'`,
                severity: "error"
              });
            }
          });

          if (item.kind === "mc-single") {
            const correctCount = item.options.filter((option) => option.isCorrect).length;
            if (correctCount !== 1) {
              issues.push({
                path: `${blockPath}.items.${itemIndex}.options`,
                message: "mc-single requires exactly one correct option",
                severity: "error"
              });
            }
          }

          if (item.kind === "mc-multi") {
            const correctCount = item.options.filter((option) => option.isCorrect).length;
            if (correctCount < 1) {
              issues.push({
                path: `${blockPath}.items.${itemIndex}.options`,
                message: "mc-multi requires at least one correct option",
                severity: "error"
              });
            }
          }

          if (item.kind === "ordering") {
            const itemIds = item.items.map((entry) => entry.id);
            const uniqueItemIds = new Set(itemIds);
            const uniqueCorrectOrder = new Set(item.correctOrder);

            if (uniqueItemIds.size !== itemIds.length) {
              issues.push({
                path: `${blockPath}.items.${itemIndex}.items`,
                message: "ordering items must use unique ids",
                severity: "error"
              });
            }

            if (item.correctOrder.length !== item.items.length) {
              issues.push({
                path: `${blockPath}.items.${itemIndex}.correctOrder`,
                message: "correctOrder length must match ordering items length",
                severity: "error"
              });
            }

            if (uniqueCorrectOrder.size !== item.correctOrder.length) {
              issues.push({
                path: `${blockPath}.items.${itemIndex}.correctOrder`,
                message: "correctOrder must not contain duplicates",
                severity: "error"
              });
            }

            item.correctOrder.forEach((id, orderIndex) => {
              if (!uniqueItemIds.has(id)) {
                issues.push({
                  path: `${blockPath}.items.${itemIndex}.correctOrder.${orderIndex}`,
                  message: `Unknown ordering id '${id}' in correctOrder`,
                  severity: "error"
                });
              }
            });
          }
        });
      }

      if (block.type === "law-case-4-step") {
        const expected = ["step_1", "step_2", "step_3", "step_4"];
        const actual = block.steps.map((step) => step.id);
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          issues.push({
            path: `${blockPath}.steps`,
            message: "Law case steps must appear in order step_1..step_4",
            severity: "error"
          });
        }
      }

      if (block.type === "solution-unlock") {
        block.solutions.forEach((solution, solutionIndex) => {
          solution.relatedQuestionIds.forEach((questionId) => {
            if (!questionIds.has(questionId)) {
              issues.push({
                path: `${blockPath}.solutions.${solutionIndex}.relatedQuestionIds`,
                message: `Unknown related question id '${questionId}'`,
                severity: "warning"
              });
            }
          });
        });
      }
    });
  });

  return issues;
}

function registerQuestionIds(
  block: ModuleBlock,
  questionIds: Set<string>,
  issues: ValidationIssue[],
  blockPath: string
): void {
  if (block.type === "competence-check") {
    block.questions.forEach((question, index) => {
      if (questionIds.has(question.id)) {
        issues.push({
          path: `${blockPath}.questions.${index}.id`,
          message: `Duplicate question id '${question.id}'`,
          severity: "error"
        });
      }
      questionIds.add(question.id);
    });
    return;
  }

  if (block.type === "rich-text-check") {
    block.prompts.forEach((prompt, index) => {
      if (questionIds.has(prompt.id)) {
        issues.push({
          path: `${blockPath}.prompts.${index}.id`,
          message: `Duplicate prompt id '${prompt.id}'`,
          severity: "error"
        });
      }
      questionIds.add(prompt.id);
    });
    return;
  }

  if (block.type === "objective-check") {
    block.items.forEach((item, index) => {
      if (questionIds.has(item.id)) {
        issues.push({
          path: `${blockPath}.items.${index}.id`,
          message: `Duplicate objective item id '${item.id}'`,
          severity: "error"
        });
      }
      questionIds.add(item.id);
    });
    return;
  }

  if (block.type === "discussion-prompt") {
    block.prompts.forEach((prompt, index) => {
      if (questionIds.has(prompt.id)) {
        issues.push({
          path: `${blockPath}.prompts.${index}.id`,
          message: `Duplicate discussion prompt id '${prompt.id}'`,
          severity: "error"
        });
      }
      questionIds.add(prompt.id);
    });
    return;
  }

  if (block.type === "law-case-4-step") {
    block.steps.forEach((step, index) => {
      const scopedId = `${block.id}.${step.id}`;
      if (questionIds.has(scopedId)) {
        issues.push({
          path: `${blockPath}.steps.${index}.id`,
          message: `Duplicate step id '${step.id}'`,
          severity: "error"
        });
      }
      questionIds.add(scopedId);
    });
  }
}
