# ADR 0004: Transition Delivery via Embed Routes

- Status: accepted
- Date: 2026-02-11

## Context

During transition, course pages are hosted through Obsidian Publish and currently embed legacy activities.

## Decision

Introduce stable React embed routes for new modules:

- `/embed/module/:moduleId?view=student`

Legacy embeds remain active until explicit migration.

## Consequences

- New modules can be rolled out without full platform cutover.
- Existing entry points stay stable for active participants.
- Embed route conventions are standardized early for analytics and support.
