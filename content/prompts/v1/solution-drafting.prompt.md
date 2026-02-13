# Solution Drafting Prompt (v1.0.0)

## Goal
Draft reviewer-visible model solutions with full question coverage.

## Inputs
- Module ID: `{{moduleId}}`
- Module title: `{{moduleTitle}}`
- Outcomes: `{{outcomes}}`
- Source snippets: `{{sources}}`

## Output contract
- Return JSON only.
- Every generated question ID must have a mapped solution item.
- Each solution item must include:
  - stable `id`
  - `title`
  - concise `content`
  - `relatedQuestionIds`

## Quality constraints
- Explain legal reasoning, not only final result.
- Keep each solution under 120 words.
- Include citation links through referenced legal IDs.
