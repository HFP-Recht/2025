# Theory Extraction Prompt (v1.0.0)

## Goal
Extract core legal theory anchors from source documents for one schema-bound module draft.

## Inputs
- Module ID: `{{moduleId}}`
- Module title: `{{moduleTitle}}`
- Module description: `{{moduleDescription}}`
- Outcomes: `{{outcomes}}`
- Source snippets: `{{sources}}`

## Output contract
- Return JSON only.
- Include legal references in `legalReferences`.
- For every legal claim, include at least one reference id.
- Do not invent references that are not present in source snippets.

## Quality constraints
- Audience: upper-secondary vocational learners.
- Language: de-CH.
- Keep wording clear and practical.
