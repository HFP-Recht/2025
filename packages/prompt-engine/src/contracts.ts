export const PROMPT_CONTRACT_VERSION = "1.0.0" as const;

export const PROMPT_TEMPLATE_IDS = [
  "theory-extraction",
  "case-study-generation",
  "competence-check",
  "solution-drafting"
] as const;

export type PromptTemplateId = (typeof PROMPT_TEMPLATE_IDS)[number];

export interface PromptConstraint {
  key: string;
  value: string;
}

export interface PromptContract {
  id: PromptTemplateId;
  version: typeof PROMPT_CONTRACT_VERSION;
  description: string;
  outputRules: string[];
  constraints: PromptConstraint[];
}

export interface PromptRenderInput {
  moduleId: string;
  moduleTitle: string;
  moduleDescription: string;
  outcomes: string[];
  sourceDocuments: Array<{
    sourceDocumentId: string;
    title: string;
    excerpt: string;
  }>;
}

export interface PromptTemplate {
  id: PromptTemplateId;
  template: string;
}
