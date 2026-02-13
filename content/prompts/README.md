# Prompt Configurations

Store prompt templates and generation constraints by module type.

Milestone 6 template set (`v1/`):

- `v1/theory-extraction.prompt.md`
- `v1/case-study-generation.prompt.md`
- `v1/competence-check.prompt.md`
- `v1/solution-drafting.prompt.md`

Prompting rules:

- Keep prompts task-specific (no single mega prompt).
- Enforce JSON-only output, aligned with module schema.
- Require legal references and citation grounding.
- Keep prompt contract version in sync with `@hfp/prompt-engine`.

Current contract version: `1.0.0`
