# Migration Plan: Unified React + Firebase Course Platform

## 1) Goals and Constraints

### Primary goals
- Build all **new modules** in a unified React platform (no new standalone `dwik/*.html`).
- Keep the site in the **same repository**.
- Keep current `dwik/` files untouched for later migration.
- Goal standalone self-hosted URL
- Enable AI-assisted module generation from source documents (case studies, theory, solutions).

### Non-goals (for this phase)
- No full migration of old `dwik/` files now.
- No immediate replacement of all legacy iframe links.
- No full deprecation of existing backend before pilot stability.

### Constraints
- Same repo must hold legacy and new platform side by side.
- Smooth transition for active participants is required.

## 2) Target Architecture (End-State)

### Frontend
- React app for student learning experience.
- Teacher dashboard for submissions, class views, exports.

### Backend and data
- Firebase Auth for student/teacher roles.
- Firestore for content, attempts, progress, metadata.
- Firebase Storage for source files and generated exports.

### Content system
- Structured block-based schema to represent:
  - theory blocks
  - case studies
  - law-case 4-step exercises
  - competence checks
  - discussions and reflection prompts

## 3) Proposed Repository Layout

```text
/dwik/                         # legacy static html, untouched for now
/docs/                         # legacy markdown/json references and source notes

/apps/
  /course-web/                 # student-facing React app
  /course-dashboard/           # teacher-facing React app

/packages/
  /content-schema/             # zod/json schema and validators
  /content-renderer/           # shared block renderer components
  /prompt-engine/              # prompt templates and generation contracts

/content/
  /sources/                    # canonical source docs for generation
  /modules/                    # generated and reviewed module JSON
  /prompts/                    # prompt configs by module type

/functions/                    # cloud functions (ai jobs, exports, migration)
/scripts/                      # migration/import/validation utilities

/MIGRATION_PLAN_REACT_CMS.md   # this plan
```

## 4) Milestones

Each milestone includes scope, deliverables, and exit criteria.

---

## Milestone 0: Program Setup and Guardrails

### Scope
- Define architecture decisions and transition rules.
- Lock legacy boundaries so old and new systems can coexist safely.

### Deliverables
- Architecture Decision Record (ADR) document set.
- Role model (`student`, `teacher`, `admin`, optional `editor`).
- Content review policy for legal accuracy.
- Decision: new modules must use structured schema only.

### Exit criteria
- Team aligns on end-state and rollout strategy.
- No new work starts in ad-hoc legacy format for future modules.

---

## Milestone 1: Monorepo Foundation in Same Repo

### Scope
- Add React apps and shared packages without touching `dwik/`.

### Deliverables
- `apps/course-web` initialized.
- `apps/course-admin` initialized.
- Shared package wiring for schema and renderer.
- Basic CI pipeline: lint, typecheck, unit tests.

### Exit criteria
- Both apps run locally.
- Legacy files still serve unchanged.
- CI is green for baseline.

---

## Milestone 2: Core Content Schema and Validation

### Scope
- Build canonical JSON schema for all new educational content.

### Deliverables
- Schema definitions for module, lesson, block, assessment, solution, hints.
- Versioned schema (`schemaVersion`).
- Validators and strict parse errors.
- Mapping guide from legacy JSON/MD to new schema.

### Exit criteria
- Sample module (theory + case study + law case) validates successfully.
- Invalid content fails with actionable errors.

---

## Milestone 3: Renderer Engine and UX Components

### Scope
- Build reusable block renderer for student-facing content.

### Deliverables
- Components for:
  - Theory block
  - Competence-check block
  - Law-case 4-step block with hints
  - Solution unlock block
  - Discussion prompt block
- Autosave and attempt state handling.
- Responsive design for iframe use and full-page use.

### Exit criteria
- One complete module renders from schema only.
- No hardcoded module-specific UI logic.

---

## Milestone 4: Data Model for Progress, Submissions, and Exports

### Scope
- Implement Firestore data model and write/read paths.

### Deliverables
- Firestore collections (example):
  - `modules`
  - `moduleVersions`
  - `enrollments`
  - `attempts`
  - `submissions`
  - `classes`
  - `users`
- Submission API in Cloud Functions.
- Export jobs:
  - student portfolio JSON
  - teacher CSV/XLSX class export
  - printable PDF export (optional phase 2)

### Exit criteria
- Student can submit and retrieve own work.
- Teacher can view class submissions and export data.

---

## Milestone 5: Auth, Roles, and Security Rules

### Scope
- Replace weak key-based access patterns with role-based auth.

### Deliverables
- Firebase Auth integration.
- Role assignment strategy (custom claims or role documents).
- Firestore/Storage security rules with tests.
- Audit logging for admin actions.

### Exit criteria
- Students can only access their own attempts/submissions.
- Teachers can only access their assigned classes.
- Admin can publish content and manage roles.

---

## Milestone 6: AI Generation Pipeline (Prompt-Engineered)

### Scope
- Build controlled generation workflow for new modules from source docs.

### Deliverables
- Prompt templates for:
  - theory extraction
  - case-study generation
  - competence-check question generation
  - solution drafting
- Grounding strategy:
  - source-doc ingestion
  - chunking and retrieval metadata
  - citations/reference fields in output
- Strict JSON output contract (schema-bound).
- Automatic validators:
  - ID consistency
  - required legal references
  - question-solution coverage
  - duplicate/contradiction checks
- Human review queue in admin UI (`draft -> review -> approved -> published`).

### Exit criteria
- New module can be generated from source docs into valid draft JSON.
- Reviewer can approve and publish without manual JSON editing.

---

## Milestone 7: Obsidian Transition Integration (Iframe Hosting)

### Scope
- Deliver React modules in Obsidian via iframe for active participants.

### Deliverables
- Stable route format (example):
  - `https://<host>/embed/module/:moduleId?view=student`
- Obsidian embed template snippets.
- Backward-compatible fallback page on embed failures.
- Analytics marker for iframe-origin sessions.

### Exit criteria
- At least one live course page on Obsidian embeds new React module.
- Student workflow (open, answer, submit, export) works end-to-end.

---

## Milestone 8: Pilot Module Release (New Module Only)

### Scope
- Release first full module built with new stack while keeping old system alive.

### Deliverables
- One production-ready module generated via AI workflow and human-reviewed.
- Teacher dashboard for this module.
- Export support validated.
- Incident runbook and rollback procedure.

### Exit criteria
- Pilot meets usability and reliability targets.
- No critical security/data loss issues.

---

## Milestone 9: Multi-Module Production Rollout

### Scope
- Scale from pilot to all upcoming modules for this course.

### Deliverables
- Repeatable module generation runbook.
- Content QA checklist for legal/educational quality.
- Performance and cost dashboards.
- Training notes for prompt engineering and editorial review.

### Exit criteria
- All new modules in this course are delivered through React platform.
- Obsidian pages only act as shell/entry points to embeds.

---

## Milestone 10: Prepare Self-Hosted Cutover (Post-Transition)

### Scope
- Remove dependency on Obsidian for delivery, keep migration path from embed URLs.

### Deliverables
- Standalone navigation and course shell in React.
- URL strategy and redirects from old embed links.
- Access model for public/private course areas.
- Final cutover checklist and communication plan.

### Exit criteria
- Course runs fully on self-hosted URL.
- Obsidian embed path remains optional or deprecated gracefully.

---

## Milestone 11: Legacy `dwik/` Migration Backlog (Later)

### Scope
- Migrate old static pages only after new modules are stable.

### Deliverables
- Inventory of `dwik/*.html` to map into schema blocks.
- Conversion scripts and manual cleanup workflow.
- Priority order by pedagogical value and usage frequency.

### Exit criteria
- Legacy migration begins without blocking ongoing new module delivery.

## 5) Suggested Timeline (Example: 14-18 Weeks)

- Weeks 1-2: Milestones 0-1
- Weeks 3-4: Milestones 2-3
- Weeks 5-6: Milestones 4-5
- Weeks 7-9: Milestone 6 (AI pipeline)
- Weeks 10-11: Milestone 7 (Obsidian iframe transition)
- Weeks 12-13: Milestone 8 (pilot release)
- Weeks 14-16: Milestone 9 (multi-module rollout)
- Weeks 17-18+: Milestone 10 preparation and cutover planning

## 6) Prompt Engineering and AI Content Ops Plan

### Prompt contracts
- Use task-specific prompts, not one mega prompt.
- Require structured output only (JSON schema).
- Include explicit constraints:
  - learning objective level
  - legal reference expectations
  - tone and audience
  - max complexity per block

### Generation workflow
1. Upload source docs (`/content/sources`).
2. Run extraction prompt (facts, legal anchors, key concepts).
3. Run block-generation prompts by type.
4. Validate JSON against schema and semantic checks.
5. Route to human review in admin.
6. Publish approved version.

### Quality controls
- Reject output without source references for legal claims.
- Require 1:1 mapping for each question to solution ID.
- Flag ambiguous wording for manual review.
- Keep version history and diff views for generated drafts.

## 7) Data and API Design Notes (Practical Baseline)

### Key entities
- `Module`: title, description, outcomes, publishedVersion.
- `ModuleVersion`: structured blocks, solution keys, metadata, generation provenance.
- `Attempt`: autosave state by student/module/version.
- `Submission`: final submitted snapshot with timestamp.
- `ClassEnrollment`: links users to classes and permissions.

### Exports
- Student export: full answer set + timestamps + module version.
- Teacher export: class-level CSV/XLSX with filtering.
- Admin export: module usage metrics and completion rates.

## 8) Risks and Mitigations

- **Risk:** AI hallucination in legal content.
  - **Mitigation:** grounding + required references + mandatory human approval.
- **Risk:** Security rule mistakes.
  - **Mitigation:** rule unit tests + staged rollout + least-privilege defaults.
- **Risk:** Cost spikes from inefficient Firestore reads.
  - **Mitigation:** query design reviews + indexing + caching where needed.
- **Risk:** Transition confusion for learners.
  - **Mitigation:** consistent iframe entry points and clear in-course instructions.
- **Risk:** Scope creep from legacy migration.
  - **Mitigation:** freeze legacy migration until after pilot success.

## 9) Definition of Done for This Course Transition

- New modules are generated through prompt-engineered pipeline into valid schema.
- New modules are rendered by React app and embedded in Obsidian via iframe.
- Student submission and teacher export flows are stable in production.
- Legacy `dwik/` remains available and untouched.
- Team has a tested path to self-hosted cutover.

## 10) Immediate Next Actions (First 2 Weeks)

1. Create `apps/course-web` and `apps/course-admin` scaffolds.
2. Implement `packages/content-schema` with first module schema.
3. Build one renderer path for theory + competence-check + law-case blocks.
4. Create one sample module JSON from existing material in `docs/`.
5. Implement iframe-ready route and embed in one Obsidian page.
6. Define first prompt template set and run one generated draft through review.
