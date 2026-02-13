# Firestore Setup Guide Across Milestones 3-5

Use this guide while implementing and validating phases 3, 4, and 5.

## Before phase 4

1. Install dependencies:

   - `npm install`

2. Authenticate Firebase CLI:

   - `firebase login`

3. Set project:

   - `firebase use <your-project-id>`

4. Start local emulators for development:

   - `npm run emulators`

## Bootstrap first admin (required once)

Because role assignment is protected, create your first admin claim once with the helper script.

1. In Firebase Console:

   - Project Settings -> Service accounts -> Generate new private key

2. Save the JSON key locally (do not commit it).
3. Run bootstrap command:

   - `SERVICE_ACCOUNT_PATH="/absolute/path/to/service-account.json" npm run bootstrap:admin -w @hfp/functions -- --email <your-admin-email> --role admin`

4. Sign out/in again in the web/admin app so the fresh token includes claims.

## Phase 4 checkpoint: data model and APIs

1. Deploy rules and indexes to emulator first:

   - `firebase emulators:start --only firestore,functions,auth,storage`

2. Seed baseline docs if needed (classes, modules, moduleVersions).
3. Verify callable functions:

   - `saveAttempt`
   - `submitModule`
   - `getMySubmissions`
   - `getClassSubmissions`
   - `exportStudentPortfolio`
   - `exportClassCsv`

4. Confirm writes are in expected collections:

   - `attempts`
   - `submissions`
   - `modules`
   - `moduleVersions`
   - `classes`
   - `users`

## Phase 5 checkpoint: auth and security rules

1. Ensure custom claims are set per user:

   - `role`
   - `classIds`

2. Run security rule tests:

   - `npm run test:rules`

3. Validate permission matrix manually:

   - Student can read/write own attempts and own submissions.
   - Teacher can read class submissions for assigned classes only.
   - Admin can publish module versions and manage role assignments.

4. Confirm admin actions generate `auditLogs` entries.

## Production rollout notes

1. Deploy rules/indexes before functions/app changes.
2. Roll out teacher/admin accounts with claims before enabling dashboards.
3. Keep emulator-backed test checklist as release gate.
