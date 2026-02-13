# Competence Check Prompt (v1.0.0)

## Goal
Generate competence-check questions that test legal understanding and application.

## Inputs
- Module ID: `{{moduleId}}`
- Module title: `{{moduleTitle}}`
- Module description: `{{moduleDescription}}`
- Outcomes: `{{outcomes}}`
- Source snippets: `{{sources}}`

## Output contract
- Return JSON only.
- Provide between 3 and 6 questions.
- Every question must include:
  - stable `id`
  - `prompt`
  - optional `hint`
  - draft `solution`
  - non-empty `requiredLegalReferences`

## Quality constraints
- Mix recall and application questions.
- Keep prompts concise and unambiguous.
- Avoid duplicate wording across questions.
