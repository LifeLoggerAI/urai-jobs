
0. COVER PAGE
Title: URAI-JOBS FIREBASE MASTER AUDIT INVENTORY
Subtitle: Full Project Inventory, Security Audit, Configuration Review, Deployment Readiness, and Handoff Record
Status: Audit Draft / Handoff Candidate / Production Blocked
Date: 2024-10-27

1. DOCUMENT PURPOSE + AUTHORITY
This document is a forensic audit of the URAI-JOBS Firebase project based on the available configuration files. It is not a speculative or best-practices guide, but an inventory of the current state based on provided evidence.

Evidence sources used:
- `firebase.json`
- `firestore.rules`

Confidence level: High for documented configurations in the provided files. Low to nonexistent for anything not explicitly defined, which will be marked UNKNOWN.

2. FIREBASE PROJECT IDENTITY
- project name: INFERRED as URAI-JOBS
- project id: UNKNOWN (not present in `firebase.json` or other files)
- environments: UNKNOWN (no `.firebaserc` to confirm multi-project setup)
- relation to URAI-JOBS app/repo: Firebase serves as the backend infrastructure. **Evidence: `firebase.json`**
- intended role of Firebase in the system: Backend-as-a-Service (BaaS) for Auth, Firestore, Storage, Functions, and Hosting.
- confirmed vs inferred stack usage:
    - CONFIRMED: Firestore, Hosting, Functions, Emulator Suite. **Evidence: `firebase.json` config blocks for `firestore`, `hosting`, `functions`, and `emulators`.**
    - INFERRED: Auth, Storage. **Evidence: `firestore.rules` references `request.auth` and `firebase.json` points to `storage.rules`.**

3. FULL SERVICE INVENTORY
- Firebase Auth: PARTIALLY IN USE. Emulator is configured (**`firebase.json`, `emulators.auth`**), and rules reference `request.auth` (**`firestore.rules`, `isSignedIn()` function**).
- Firestore: IN USE. **Evidence: `firebase.json` contains a `firestore` block.**
- Storage: PARTIALLY IN USE. **Evidence: `firebase.json` contains a `storage` block.**
- Cloud Functions / Functions v2: PARTIALLY IN USE. Source directory is configured. **Evidence: `firebase.json`, `functions.source` key.**
- Hosting / App Hosting: IN USE. **Evidence: `firebase.json` contains a `hosting` block.**
- Emulator Suite: IN USE. **Evidence: `firebase.json` contains an `emulators` block.**
- Firestore Indexes: PARTIALLY IN USE. An index file is specified. **Evidence: `firebase.json`, `firestore.indexes` key.** Content of the file is UNKNOWN.
- Firestore Rules: IN USE. **Evidence: `firestore.rules` file is present and populated.**
- Storage Rules: PARTIALLY IN USE. A rule file is specified. **Evidence: `firebase.json`, `storage.rules` key.** Content of the file is UNKNOWN.
- Pub/Sub if used: UNKNOWN.
- Cloud Scheduler if used: UNKNOWN.
- Secret Manager usage: UNKNOWN.
- Extensions if used: UNKNOWN.
- Analytics if used: UNKNOWN.
- Crashlytics if used: UNKNOWN.
- Remote Config if used: UNKNOWN.
- Messaging / FCM if used: UNKNOWN.
- App Check if used: UNKNOWN.
- Custom Claims / IAM-related auth patterns: UNKNOWN.
- Admin SDK usage: INFERRED for functions. UNKNOWN otherwise.
- environment variable / secret injection: UNKNOWN.

4. REPO-LEVEL FIREBASE FILE INVENTORY
- `firebase.json`: PRESENT. **Evidence: File content was read.** Appears authoritative for service configuration.
- `.firebaserc`: UNKNOWN.
- `firestore.rules`: PRESENT. **Evidence: File content was read.** Defines security rules for Firestore.
- `firestore.indexes.json`: MISSING (Content UNKNOWN). Path is defined in `firebase.json`, but the file itself was not provided.
- `storage.rules`: MISSING (Content UNKNOWN). Path is defined in `firebase.json`, but the file itself was not provided.
- `functions/package.json`: UNKNOWN.
- `functions/src/**`: UNKNOWN.
- `scripts/deploy*`: UNKNOWN.
- `scripts/seed*`: UNKNOWN.
- `scripts/migrate*`: UNKNOWN.
- emulator config: PRESENT. **Evidence: `firebase.json`, `emulators` block.**
- env examples: UNKNOWN.
- auth/session helpers: UNKNOWN.
- firebase client init: UNKNOWN.
- admin sdk init: UNKNOWN.
- callable wrappers: UNKNOWN.
- rules tests if any: UNKNOWN.

5. FIRESTORE AUDIT
- **Confirmed Collections**:
    - `/users/{userId}`: CONFIRMED. **Evidence: `firestore.rules`, `match /users/{userId}`.**
    - `/orgs/{orgId}`: CONFIRMED. **Evidence: `firestore.rules`, `match /orgs/{orgId}`.**
    - `/jobs/{jobId}`: CONFIRMED. **Evidence: `firestore.rules`, `match /jobs/{jobId}`.**
    - `/applications/{applicationId}`: CONFIRMED. **Evidence: `firestore.rules`, `match /applications/{applicationId}`.**
- **Collection-by-Collection Security Assessment**:
    - `users`: BROKEN. Rule allows users to write to their own document (`allow read, write: if request.auth.uid == userId;`). This allows a user to change their `orgId`, which bypasses all other security rules. **RISK: Critical tenant data leakage.**
    - `orgs`: PARTIAL. Reads are correctly restricted to users within the organization (`allow read: if isSignedIn() && getOrgId(request.auth.uid) == orgId;`). Writes are blocked from the client, which is good (`allow write: if false;`).
    - `jobs`: CONFIRMED. Public reads are allowed (`allow read: if true;`), and client writes are blocked (`allow write: if false;`). This is appropriate.
    - `applications`: PARTIAL. Creation is restricted to the user themselves (`allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;`). However, allowing a user to `update` their own application freely could allow them to change its state outside of the intended workflow.
- **Missing Indexes**: UNKNOWN.
- **Stale Indexes**: UNKNOWN.
- **Dangerous Broad Queries**: The `getOrgId` function performs a `get()` call inside the rules, which can be inefficient and costly at scale, but is not inherently dangerous from a security perspective in this specific usage.

6. FIRESTORE RULES AUDIT
- **What the rules protect**: They attempt to protect org-specific data and user-specific application data.
- **What they fail to protect**: They fail to protect against a user changing their own `orgId` to gain access to another organization's data.
- **Tenant/org isolation**: BROKEN. The entire model relies on `getOrgId(uid)`, which reads a user-writable field. **Evidence: `firestore.rules`, `getOrgId` function and `match /users/{userId}`.**
- **Admin overrides**: NOT STARTED. There is no concept of an admin role in these rules.
- **PASS / FAIL judgment**: **FAIL.**
- **Release Blockers**: The ability for a user to edit their own `orgId` is a critical security vulnerability that blocks any production deployment.

7. STORAGE AUDIT
- All items are UNKNOWN as the `storage.rules` file was not provided.

8. AUTH AUDIT
- **Providers in use**: UNKNOWN.
- **Signup/login flows**: UNKNOWN.
- **Custom claims if any**: UNKNOWN. `firestore.rules` does not reference `request.auth.token`.
- **Role lookup method**: The rules only check for sign-in status (`request.auth != null`) and user's `orgId` from their user profile. There are no distinct roles. **Evidence: `firestore.rules`, `isSignedIn` and `getOrgId` functions.**
- **RISK**: Roles are not being used, which means there is no distinction between a regular user and an admin/operator within an organization.

9. CLOUD FUNCTIONS / BACKEND AUTHORITY AUDIT
- **Inventory**: All functions are UNKNOWN.
- **Direct client mutation vs server-authoritative mutation**: The rules correctly block client-side writes to `jobs` and `orgs`, implying server-side authority is intended. **Evidence: `firestore.rules`, `allow write: if false;` on `jobs` and `orgs` matches.**
- **RISK**: The functions themselves are a black box. We have no evidence they perform the necessary auth checks, validation, or audit logging.

10. HOSTING / APP DEPLOYMENT AUDIT
- **Hosting target**: `web/dist`. **Evidence: `firebase.json`, `hosting.public`.**
- **Rewrites**: All paths are rewritten to `/index.html`. This is a standard SPA configuration. **Evidence: `firebase.json`, `hosting.rewrites` block.**
- **Deployment**: Appears deterministic based on config, but UNKNOWN without deployment scripts.

11. ENVIRONMENT / SECRETS / CONFIG AUDIT
- UNKNOWN.

12. EMULATOR + LOCAL DEV AUDIT
- **Emulator Suite**: CONFIRMED. All major services (Auth, Functions, Firestore, Storage, Hosting) and the UI are configured. **Evidence: `firebase.json`, `emulators` block.**
- **Local Development**: Appears possible from a configuration standpoint. Seeding/migration flows are UNKNOWN.

13. CI/CD + DEPLOYMENT PIPELINE AUDIT
- UNKNOWN.

14. SECURITY + PRIVACY RISK REGISTER
- **Risk Name**: Tenant Data Leakage via User Profile Mutation.
- **Severity**: CRITICAL.
- **Affected Area**: Firestore.
- **Evidence**: `firestore.rules`, specifically `match /users/{userId} { allow read, write: if request.auth.uid == userId; }` combined with the `getOrgId` function.
- **Exploit/Failure Mode**: A malicious user can call `update` on their own user document in the `/users` collection and set the `orgId` field to another organization's ID. All subsequent rule checks via `getOrgId` will now grant them access to the target organization's data.
- **Required Fix**: Change the user write rule to prevent modification of the `orgId` field. E.g., `allow update: if request.resource.data.orgId == resource.data.orgId;`

15. CURRENT STATE MATRIX
- **Auth**: PARTIAL
- **Firestore schema**: PARTIAL
- **Firestore rules**: BROKEN
- **Storage**: UNKNOWN
- **Storage rules**: UNKNOWN
- **Functions**: UNKNOWN
- **Hosting**: CONFIRMED
- **Env/config**: UNKNOWN
- **Emulators**: CONFIRMED
- **CI/CD**: UNKNOWN
- **Testing**: UNKNOWN
- **Logging/auditing**: UNKNOWN
- **Security hardening**: NOT STARTED
- **Tenant isolation**: BROKEN
- **Admin tooling**: NOT STARTED
- **Production readiness**: NOT READY

16. PRODUCTION READINESS VERDICT
- **Verdict**: **Not ready.**
- **Reason**: The Firestore rules contain a critical, fundamental security vulnerability that allows any user to gain access to any organization's data. This is a production blocker of the highest severity. **Evidence: The tenant data leakage risk identified in sections 6 and 14.**

17. TOP BLOCKERS
1.  **CRITICAL SECURITY**: Firestore rules allow users to switch organizations by modifying their user profile.
2.  **UNKNOWN IMPLEMENTATION**: The code for Cloud Functions is missing, so the core business logic cannot be audited.
3.  **INCOMPLETE CONFIG**: `storage.rules` and `firestore.indexes.json` are missing.

18. REQUIRED FIX PLAN
- **Phase 1: Security Hardening (Immediate)**
    - **Goal**: Patch the critical tenant leakage vulnerability.
    - **Task**: Modify the `/users/{userId}` Firestore rule to prevent users from changing their `orgId`.
- **Phase 2: Truth Lock**
    - **Goal**: Get a full picture of the system.
    - **Task**: Obtain and audit the source code for the Cloud Functions and the content of `storage.rules` and `firestore.indexes.json`.

19. HANDOFF INVENTORY
A new engineer would need:
- The source code for the `functions` directory.
- The content of `storage.rules`.
- The content of `firestore.indexes.json`.
- Any environment variable files (`.env`).
- Any deployment scripts (`scripts/deploy.sh`, etc.).

20. CANON CONFLICT REGISTER
- The stated goal of a multi-tenant hiring application is in **direct conflict** with the implemented Firestore rules which fail to enforce tenant isolation. **Evidence: `firestore.rules`.**

21. FINAL EXECUTIVE TRUTH
The URAI-JOBS Firebase project is in an early, demonstrably insecure state. Configuration for hosting and local emulation is present, but the core security model in Firestore is broken, allowing any user to impersonate a member of another organization. The backend logic in Cloud Functions is completely unknown. It is not safe for any multi-user or production scenario.
