# Case Study Generation Prompt (v1.0.0)

## Goal
Generate one practical law-case 4-step block grounded in source content.

## Inputs
- Module ID: `{{moduleId}}`
- Module title: `{{moduleTitle}}`
- Outcomes: `{{outcomes}}`
- Source snippets: `{{sources}}`

## Output contract
- Return JSON only.
- Use exactly four steps with IDs `step_1` to `step_4`.
- Every step must include `title`, `prompt`, and `solution`.
- Case facts must be realistic for vocational workshop context.

## Quality constraints
- Keep the case concise (max 220 words).
- Add one hint per step.
- Ensure the final step has a clear legal consequence.
