# ADR 0003: Schema-First Content Contract

- Status: accepted
- Date: 2026-02-11

## Context

Legacy content formats vary by assignment type and UI implementation details.

## Decision

All new modules use a versioned structured schema in `packages/content-schema` with strict validation.

The schema supports:

- theory blocks
- competence checks
- law-case 4-step blocks with hints
- solution unlock blocks
- discussion prompt blocks

## Consequences

- Rendering is data-driven and reusable.
- Validation errors are actionable before publishing.
- Migration from old JSON/markdown can be staged with mapping rules.
