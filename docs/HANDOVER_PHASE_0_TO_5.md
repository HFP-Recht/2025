# Handover: Phase 0 to 5 Completion (React + Firebase Migration)

Date: 2026-02-11
Project: `hfp-recht`
Repository root: `D:\OneDrive - bbw.ch\.work\HFP\2025`

## 1. What is complete

This handover covers Milestones/Phases 0 through 5 from `MIGRATION_PLAN_REACT_CMS.md`.

### Phase 0: Program setup and guardrails

- ADR set created in `docs/adr/`.
- Legacy/new boundary documented (`dwik/` untouched for new modules).
- Role model and authorization strategy documented.
- Legal content review policy documented.
- Contribution guardrails added in `CONTRIBUTING.md`.

### Phase 1: Monorepo foundation

- Workspace layout created:
  - `apps/course-web`
  - `apps/course-admin`
  - `packages/content-schema`
  - `packages/content-renderer`
  - `functions`
- Shared TypeScript and ESLint setup in root.
- CI pipeline added in `.github/workflows/ci.yml`.

### Phase 2: Core schema and validation

- Schema package implemented in `packages/content-schema/src/`.
- Strict parsing + semantic validation implemented.
- Sample module added: `content/modules/sample-module.v1.json`.
- Validation script added: `scripts/validate-module.ts`.
- Legacy mapping guide added: `docs/migration/content-mapping-guide.md`.

### Phase 3: Renderer and UX components

- Reusable renderer added: `packages/content-renderer/src/ModuleRenderer.tsx`.
- Student app route support:
  - `/module/:moduleId`
  - `/embed/module/:moduleId`
- Autosave + submission UX implemented in `apps/course-web`.

### Phase 4: Data model, submissions, exports

- Firestore model and indexes added (`firestore.indexes.json`).
- Cloud Functions callable APIs added in `functions/src/index.ts`.
- Student submit flow and class CSV export work in production.
- Admin dashboard can load submissions, export CSV, and view detailed answers.
- Submission detail callable added (`getSubmissionDetail`) and wired in admin UI.

### Phase 5: Auth, roles, security rules, audit

- Firebase Auth role-claim flow implemented.
- Firestore and Storage rules added and tested.
- Admin role assignment callable implemented.
- Publish callable implemented with audit logging.
- Audit entries verified in `auditLogs`.

## 2. Current runtime status

- Firebase project: `hfp-recht` (`.firebaserc` set).
- Firestore rules/indexes deployed.
- Storage rules deployed.
- Functions deployed in `europe-west6`.
- Student registration via access key enabled.
- Student submissions persist and are retrievable across browsers.

## 3. Key callable functions (production)

Defined in `functions/src/index.ts`:

- Content/learning:
  - `getPublishedModule`
  - `saveAttempt`
  - `getMyAttempt`
  - `submitModule`
  - `getMySubmissions`
- Teacher/admin review:
  - `getClassSubmissions`
  - `getSubmissionDetail`
  - `exportClassCsv`
  - `exportStudentPortfolio`
- Admin/security:
  - `assignUserRole`
  - `publishModuleVersion`
  - `createStudentAccessKey`
  - `registerStudentWithAccessKey`

## 4. Admin and student flows now available

### Student

- Register with email/password + admin-generated access key.
- Login and work through module.
- Autosave to local + Firestore draft.
- Submit final answer set.
- Return in another browser and continue/review saved state.

### Admin

- Generate student access keys (class-bound, max usage, expiry).
- Load class submissions.
- Export class CSV.
- Open each submission and inspect full answer payload.
- Assign roles.
- Publish module versions.

## 5. Files of interest for next instance

### Backend

- `functions/src/index.ts`
- `firestore.rules`
- `storage.rules`
- `firestore.indexes.json`

### Student app

- `apps/course-web/src/pages/LoginPage.tsx`
- `apps/course-web/src/pages/ModulePlayerPage.tsx`
- `apps/course-web/src/firestoreApi.ts`

### Admin app

- `apps/course-admin/src/pages/DashboardPage.tsx`
- `apps/course-admin/src/firestoreApi.ts`
- `apps/course-admin/src/styles.css`

### Governance/docs

- `docs/adr/*.md`
- `docs/policies/legal-content-review-policy.md`
- `docs/firestore/milestone-setup-guide.md`

## 6. Validation status

Commands run successfully before handover:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:rules`

Functions were redeployed after the final submission-detail feature.

## 7. Known gaps / technical debt (non-blocking for phase 0-5)

- CSV export currently contains submission metadata only, not flattened answer content.
- Functions package still uses Node 20 and an older `firebase-functions` warning appears during deploy.
- No dedicated admin audit-log UI yet (logs are in Firestore `auditLogs`).
- Rules tests are focused and should be expanded for new callables as coverage grows.

## 8. Next-phase starting points (phase 6+)

Recommended order for next instance:

1. AI generation pipeline contracts and prompt templates (`content/prompts`, `packages/prompt-engine`).
2. Human review queue UX (`draft -> review -> approved -> published`).
3. Citation/reference enforcement and semantic validators for generated legal content.
4. Obsidian iframe transition packaging and fallback handling.
5. Pilot module hardening metrics (error telemetry, usage, completion, cost).

## 9. Security note

- A Firebase service account key is present locally under `docs/` during setup.
- Rotate this key in Firebase Console if it was shared or exposed.
- Keep service account JSON files out of commits (`.gitignore` includes adminsdk patterns).

## 10. Phase 6+ update: technical proof of work (2026-02-12)

This section captures the post-phase-5 implementation that demonstrates the app can run professional classroom modules in native React interactions (no iframe dependence for core exercises).

### 10.1 What was added

- Content schema and renderer now support richer didactic interactions.
- A 4-tab classroom mock module was implemented and wired into the student app.
- The student player now runs those tabs and interactions end-to-end with existing autosave, submission, and analytics flows.

### 10.2 New schema blocks and interaction model

Updated schema package:

- `packages/content-schema/src/schema.ts`
- `packages/content-schema/src/validation.ts`

New block types:

- `rich-text-check`
  - long-form prompts intended for Quill editing
  - keeps `requiredLegalReferences`, `hint`, optional `solution`
- `objective-check`
  - `mc-single`
  - `mc-multi`
  - `true-false`
  - `matching`
  - `ordering`
  - `cloze`

Semantic validation was expanded for:

- duplicate IDs across prompt/question/objective/discussion entities
- legal reference consistency
- objective integrity checks (single-choice correctness, ordering consistency, etc.)

### 10.3 Renderer upgrades (student UX foundation)

Updated renderer package:

- `packages/content-renderer/src/ModuleRenderer.tsx`
- `packages/content-renderer/src/styles.css`
- `packages/content-renderer/package.json`

Key behavior:

- New lesson tabs mode (`lessonLayout="tabs"`) for one-page, multi-tab learning units.
- Native Quill editor integration for rich-text prompts.
- Native objective widgets with formative feedback (no points/scoring system).
- Existing blocks (`theory`, `law-case-4-step`, `discussion-prompt`, `solution-unlock`) remain compatible.

### 10.4 Classroom mock module (proof of work content)

Implemented module file:

- `content/modules/classroom/woche3-haftung-gewaehrleistung.v1.generated.json`

Wired for local runtime:

- `apps/course-web/src/moduleService.ts`

Student player route already supports tabs and renders this module:

- `apps/course-web/src/pages/ModulePlayerPage.tsx`

Open locally:

- `http://localhost:5173/module/woche3-haftung-gewaehrleistung`
- embed: `http://localhost:5173/embed/module/woche3-haftung-gewaehrleistung?view=student&origin=obsidian`

### 10.5 Why this is a valid technical proof of work

The system now demonstrates:

- schema-first classroom unit composition with strong validation
- native React interactions for long-form and objective exercises
- professional 4-tab module structure in one page
- compatibility with existing draft/save/submit/analytics and role model

This confirms the architecture is ready for a larger UX/UI redesign without changing the core backend contracts.

### 10.6 Redesign surfaces (for full LMS feeling)

To fundamentally redesign layout, interactions, dashboards, and overall LMS feel, the main change surfaces are:

- Student shell and page IA:
  - `apps/course-web/src/pages/ModulePlayerPage.tsx`
  - `apps/course-web/src/styles.css`
- Block interaction UX and didactic components:
  - `packages/content-renderer/src/ModuleRenderer.tsx`
  - `packages/content-renderer/src/styles.css`
- Teacher/admin workflow UX:
  - `apps/course-admin/src/pages/milestone/DashboardPage.tsx`
  - `apps/course-admin/src/styles.css`

Keep these stable while redesigning:

- schema contracts and deterministic IDs
- role-based access and legal review lifecycle (`draft -> review -> approved -> published`)
- student draft/submission persistence model

### 10.7 Verification status (post-update)

Successful runs after implementing this proof-of-work update:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npx tsx scripts/validate-module.ts content/modules/classroom/woche3-haftung-gewaehrleistung.v1.generated.json`
