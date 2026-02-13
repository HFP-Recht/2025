# Legacy to Schema Mapping Guide

This guide maps current legacy JSON/markdown structures to the new schema in `packages/content-schema`.

## Input source examples

- `docs/01-grundlagen-des-vertragsrechts.json`
- `docs/fallstudien-zu-schweizer-rechtsystem.json`
- `docs/01 Vertragsform.md`
- `docs/03 Rechtsfaelle.md`

## Mapping table

- `assignmentTitle` -> `module.title`
- `subAssignments` -> `lessons[].blocks[]`
- `subAssignments[*].type = "quill"` -> `rich-text-check` block (recommended) or `competence-check` block (legacy-compatible fallback)
- `subAssignments[*].type = "law_case"` -> `law-case-4-step` block
- `hints[]` -> `steps[].hint` (law case) or `questions[].hint` (competence-check)
- `solution.solutions[]` -> `solution-unlock.solutions[]` and/or inline question solutions
- `discussion[]` -> `discussion-prompt.prompts[]`

### New classroom-ready mappings

- Concept-check JSON/CSV question pools -> `objective-check` blocks
  - single-answer MCQ -> `kind = "mc-single"`
  - multi-answer MCQ -> `kind = "mc-multi"`
  - true/false -> `kind = "true-false"`
  - matching -> `kind = "matching"`
  - ordering -> `kind = "ordering"`
  - fill-in-the-gap -> `kind = "cloze"`

## Rules during migration

1. Preserve legal references in `legalReferences` and `requiredLegalReferences`.
2. Keep stable IDs and use deterministic naming (`moduleId`, `blockId`, `questionId`).
3. Move solution keys out of client-delivered content.
4. Validate every converted module with:

   - `npm run validate:module -- content/modules/<module-file>.json`

5. Prefer classroom module structure with 4 tabs as default (editable):

   - `01 Grundlagen`
   - `02 Das Wichtigste in Kuerze`
   - `03 Rechtsfaelle`
   - `04 Mindmap und Transfer`

## Legacy markdown notes

Obsidian markdown pages currently embed iframes. During migration:

- keep markdown pages as transition shell only,
- replace legacy iframe URLs with new React embed routes per module,
- keep pedagogical text and prompts in markdown as needed, but module interaction content must live in schema JSON.
