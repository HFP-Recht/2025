# Pilot Runbook (Milestone 8)

Date: 2026-02-11
Scope: `pilot-vertragsrecht` module lifecycle (`draft -> review -> approved -> published`)

## 1. Pre-release checklist

1. Source documents are ingested in admin (`sourceDocuments`, `sourceChunks`).
2. Draft generation succeeds with no validation errors.
3. Reviewer moves version to `approved` in review queue.
4. Admin publishes approved version.
5. Obsidian page uses stable embed route and fallback link.
6. Student flow validated end-to-end:
   - open module
   - autosave
   - submit
   - teacher export CSV

## 2. Live monitoring signals

- `analyticsEvents` contains `embed_open` and `module_submit` events for pilot module.
- Admin metrics panel shows non-zero opens and submissions.
- Error indicators:
  - repeated module load failures
  - validation errors on new draft attempts
  - missing submissions after student session activity

## 3. Incident handling

1. Classify impact:
   - P1: students cannot open/submit
   - P2: degraded performance or partial feature loss
   - P3: cosmetic/admin-only issue
2. Capture context:
   - module version id
   - affected class id(s)
   - timeframe
   - exact error text/screenshots
3. Contain:
   - pause new publish actions
   - communicate fallback direct module link
4. Mitigate:
   - hotfix callable/client issue
   - redeploy affected app/functions
5. Validate:
   - repeat student submit path and teacher export
6. Close:
   - log incident note in project tracking
   - document root cause and preventive action

## 4. Rollback procedure

Use this when a published pilot version causes blocking issues.

1. Identify rollback target:
   - choose last known-good `moduleVersionId` for `pilot-vertragsrecht`
   - ensure status is `approved` or `published`
2. Execute rollback:
   - in admin, publish the known-good version
   - if needed, run callable `publishModuleVersion` directly with target id
3. Verify rollback:
   - open `/embed/module/pilot-vertragsrecht?origin=obsidian`
   - submit one test attempt
   - check teacher CSV export
4. Communicate:
   - notify teaching staff of rollback completion
   - share expected learner impact window

## 5. Post-incident follow-up

- Create a new draft for fix-forward changes.
- Repeat review approvals before re-publishing.
- Add missing test coverage (rules, callable validation, UI workflow).
