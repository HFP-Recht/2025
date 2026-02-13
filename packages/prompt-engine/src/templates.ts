import {
  PROMPT_CONTRACT_VERSION,
  type PromptContract,
  type PromptRenderInput,
  type PromptTemplate,
  type PromptTemplateId
} from "./contracts";

export const PROMPT_CONTRACTS: Record<PromptTemplateId, PromptContract> = {
  "theory-extraction": {
    id: "theory-extraction",
    version: PROMPT_CONTRACT_VERSION,
    description: "Extract central legal theory anchors from source material.",
    outputRules: [
      "Return JSON only.",
      "Every legal claim must include at least one citation id.",
      "Do not invent references that are not grounded in sources."
    ],
    constraints: [
      { key: "audience", value: "Upper-secondary vocational learners" },
      { key: "language", value: "de-CH" },
      { key: "max_theory_blocks", value: "2" }
    ]
  },
  "case-study-generation": {
    id: "case-study-generation",
    version: PROMPT_CONTRACT_VERSION,
    description: "Generate one law-case 4-step scenario from grounded sources.",
    outputRules: [
      "Return JSON only.",
      "Use exactly 4 steps with ids step_1..step_4.",
      "Each step must contain prompt and solution draft."
    ],
    constraints: [
      { key: "difficulty", value: "progressive from Grundlagen to Anwenden" },
      { key: "tone", value: "clear, didactic, practical" },
      { key: "max_case_words", value: "220" }
    ]
  },
  "competence-check": {
    id: "competence-check",
    version: PROMPT_CONTRACT_VERSION,
    description: "Generate competence-check questions with legal references.",
    outputRules: [
      "Return JSON only.",
      "Every question id must be unique and stable.",
      "Every question must map to at least one legal reference id."
    ],
    constraints: [
      { key: "question_count", value: "3-6" },
      { key: "answer_format", value: "short free-text" },
      { key: "complexity", value: "mixed recall and application" }
    ]
  },
  "solution-drafting": {
    id: "solution-drafting",
    version: PROMPT_CONTRACT_VERSION,
    description: "Draft reviewer-visible sample solutions with coverage metadata.",
    outputRules: [
      "Return JSON only.",
      "Provide one solution item for every question id.",
      "Keep wording concise and legally grounded."
    ],
    constraints: [
      { key: "pedagogy", value: "explain reasoning, not only outcome" },
      { key: "citation_required", value: "true" },
      { key: "max_words_per_solution", value: "120" }
    ]
  }
};

export const PROMPT_TEMPLATES: Record<PromptTemplateId, PromptTemplate> = {
  "theory-extraction": {
    id: "theory-extraction",
    template: [
      "Task: Extract theory anchors for module {{moduleId}} ({{moduleTitle}}).",
      "Description: {{moduleDescription}}",
      "Outcomes: {{outcomes}}",
      "Sources:\n{{sources}}",
      "Return schema-bound JSON with legal references and citations."
    ].join("\n")
  },
  "case-study-generation": {
    id: "case-study-generation",
    template: [
      "Task: Generate one law-case 4-step block for module {{moduleId}}.",
      "Context: {{moduleTitle}}",
      "Target outcomes: {{outcomes}}",
      "Grounding snippets:\n{{sources}}",
      "Return JSON only, with step_1..step_4 and draft solutions."
    ].join("\n")
  },
  "competence-check": {
    id: "competence-check",
    template: [
      "Task: Create competence-check questions for module {{moduleId}}.",
      "Description: {{moduleDescription}}",
      "Learning outcomes: {{outcomes}}",
      "Grounded source snippets:\n{{sources}}",
      "Return JSON with question ids, prompts, hints, solution drafts, and requiredLegalReferences."
    ].join("\n")
  },
  "solution-drafting": {
    id: "solution-drafting",
    template: [
      "Task: Draft solution unlock payload for module {{moduleId}}.",
      "Context: {{moduleTitle}}",
      "Outcomes: {{outcomes}}",
      "Grounded source snippets:\n{{sources}}",
      "Return JSON that maps each question id to one solution item."
    ].join("\n")
  }
};

export function buildPromptBundle(input: PromptRenderInput): Record<PromptTemplateId, string> {
  const baseContext = {
    moduleId: input.moduleId,
    moduleTitle: input.moduleTitle,
    moduleDescription: input.moduleDescription,
    outcomes: input.outcomes.join(" | "),
    sources: input.sourceDocuments
      .map((document) => `- [${document.sourceDocumentId}] ${document.title}: ${document.excerpt}`)
      .join("\n")
  };

  return {
    "theory-extraction": renderTemplate(PROMPT_TEMPLATES["theory-extraction"].template, baseContext),
    "case-study-generation": renderTemplate(
      PROMPT_TEMPLATES["case-study-generation"].template,
      baseContext
    ),
    "competence-check": renderTemplate(PROMPT_TEMPLATES["competence-check"].template, baseContext),
    "solution-drafting": renderTemplate(PROMPT_TEMPLATES["solution-drafting"].template, baseContext)
  };
}

export function renderTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = context[key];
    return typeof value === "string" ? value : "";
  });
}
