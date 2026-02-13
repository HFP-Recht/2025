# Contributing Guardrails for Migration

## Legacy boundary

- Do not add new modules to `dwik/` or new standalone HTML learning pages.
- Legacy `dwik/` fixes are allowed only for bug fixes and stability.
- New learning content must use the structured schema in `packages/content-schema` and be stored in `content/modules`.

## Content quality and legal review

- Any module containing legal claims must include legal reference metadata.
- Drafts must go through review status changes: `draft -> review -> approved -> published`.
- Publication requires human review by an authorized reviewer.

## Auth and data handling

- Do not add key-based client-side access checks for new features.
- Use Firebase Auth + role-based authorization for all new write paths.
- Student data must only be accessible to the student, assigned teachers, and admins.

## Definition of acceptable changes (phases 0-5)

- Keep legacy pages working and untouched by default.
- Prefer changes in `apps/`, `packages/`, `functions/`, and `content/`.
- Add or update tests for schema validation, security rules, and critical app flows.
