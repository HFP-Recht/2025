# ADR 0002: Role Model and Authorization Strategy

- Status: accepted
- Date: 2026-02-11

## Context

Legacy flows use key-based access patterns. New platform requires auditable and least-privilege access.

## Decision

Use Firebase Auth with role-based access and class scoping:

- `student`: read/write own attempts and submissions.
- `teacher`: read submissions for assigned classes and export class data.
- `admin`: manage roles, class assignment, publish module versions, and review logs.
- `editor` (optional): prepare module drafts for admin publication.

Role and class scopes are carried in custom claims (`role`, `classIds`) and mirrored in user documents for admin visibility.

## Consequences

- Access checks move from client-side keys to server/rules enforcement.
- Teacher access remains class-bounded.
- Security rules and callable functions become the system-of-record for authorization.
