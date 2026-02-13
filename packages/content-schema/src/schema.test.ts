import { describe, expect, it } from "vitest";
import {
  parseModuleVersion,
  validateModuleSemantics,
  type ModuleVersion
} from "./index";

const validModule: ModuleVersion = {
  schemaVersion: "1.0.0",
  moduleId: "module-1",
  title: "Testmodul",
  description: "Beschreibung",
  outcomes: ["Outcome 1"],
  version: 1,
  status: "draft",
  legalReferences: [{ id: "or-art-1", citation: "OR Art. 1" }],
  metadata: { language: "de-CH" },
  lessons: [
    {
      lessonId: "lesson-1",
      title: "Lesson 1",
      blocks: [
        {
          id: "theory-1",
          type: "theory",
          title: "Theory",
          content: "Theory content"
        },
        {
          id: "check-1",
          type: "competence-check",
          title: "Check",
          questions: [
            {
              id: "q-1",
              prompt: "Question",
              requiredLegalReferences: ["or-art-1"]
            }
          ]
        },
        {
          id: "rich-1",
          type: "rich-text-check",
          title: "Rich Text",
          prompts: [
            {
              id: "rq-1",
              prompt: "Explain the legal difference.",
              requiredLegalReferences: ["or-art-1"]
            }
          ]
        },
        {
          id: "objective-1",
          type: "objective-check",
          title: "Objective",
          items: [
            {
              id: "oq-1",
              kind: "mc-single",
              prompt: "Choose one",
              options: [
                { id: "a", text: "A", isCorrect: true },
                { id: "b", text: "B", isCorrect: false }
              ],
              requiredLegalReferences: ["or-art-1"]
            }
          ]
        },
        {
          id: "law-1",
          type: "law-case-4-step",
          title: "Law",
          caseText: "Case",
          steps: [
            { id: "step_1", title: "Step 1", prompt: "Prompt 1" },
            { id: "step_2", title: "Step 2", prompt: "Prompt 2" },
            { id: "step_3", title: "Step 3", prompt: "Prompt 3" },
            { id: "step_4", title: "Step 4", prompt: "Prompt 4" }
          ]
        },
        {
          id: "solution-1",
          type: "solution-unlock",
          title: "Solutions",
          unlockMode: "role-based",
          allowedRoles: ["teacher"],
          solutions: [{ id: "s-1", title: "S", content: "A", relatedQuestionIds: ["q-1"] }]
        },
        {
          id: "discussion-1",
          type: "discussion-prompt",
          title: "Discussion",
          prompts: [{ id: "d-1", prompt: "Discuss" }]
        }
      ]
    }
  ]
};

describe("content schema", () => {
  it("parses valid module", () => {
    const parsed = parseModuleVersion(validModule);
    expect(parsed.moduleId).toBe("module-1");
  });

  it("rejects invalid module", () => {
    const invalid = {
      ...validModule,
      lessons: [
        {
          ...validModule.lessons[0],
          blocks: [
            {
              id: "law-1",
              type: "law-case-4-step",
              title: "Law",
              caseText: "Case",
              steps: [{ id: "step_1", title: "Step 1", prompt: "Prompt 1" }]
            }
          ]
        }
      ]
    };

    expect(() => parseModuleVersion(invalid)).toThrow(/Module validation failed/);
  });

  it("reports semantic errors for duplicate IDs", () => {
    const duplicate = {
      ...validModule,
      lessons: [
        {
          ...validModule.lessons[0],
          blocks: [
            validModule.lessons[0].blocks[0],
            validModule.lessons[0].blocks[0]
          ]
        }
      ]
    };

    const parsed = parseModuleVersion(duplicate);
    const issues = validateModuleSemantics(parsed);

    expect(issues.some((issue) => issue.message.includes("Duplicate block id"))).toBe(true);
  });
});
