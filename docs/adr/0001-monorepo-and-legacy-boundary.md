# ADR 0001: Monorepo and Legacy Boundary

- Status: accepted
- Date: 2026-02-11

## Context

The repository currently serves legacy learning material through static pages and embeds. The migration strategy requires introducing a new React/Firebase platform without breaking active course delivery.

## Decision

1. Keep legacy and new platform in the same repository.
2. Introduce workspaces under `apps/`, `packages/`, and `functions/`.
3. Keep `dwik/` untouched for normal feature development.
4. Restrict new module creation to schema-based JSON in `content/modules`.

## Consequences

- Legacy and new platform can run side by side.
- CI and tooling can cover both React apps and backend functions.
- Existing learners are not disrupted while new modules are piloted.
