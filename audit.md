# URAI-JOBS Freeze-and-Repair Audit

## 1. Brief Truth-Based Summary

Based on a static analysis of the codebase, URAI-JOBS appears to be a conventional Firebase-backed job board. The core CRUD (Create, Read, Update, Delete) functionality for users, jobs, and applications seems to be present in the Firebase functions. However, the AI-native features that the project appears to market, such as recommendation, resume parsing, and job-matching, are not implemented and exist only as stubs. The project is not in a launchable state, and its positioning as an "AI-native product" is misleading. The immediate bottleneck is not feature ideation but rather completion, hardening, and verification of the existing codebase.

## 2. Confidence Level and Why

**Confidence Level: VERY LOW**

The local development environment is broken. All attempts to install dependencies, lint, build, and run the project have failed due to timeouts. This prevents any runtime verification of the application's behavior. This audit is therefore based on a static analysis of the code. Key aspects that remain unverified without execution include:

*   Whether the local development flow can boot cleanly end-to-end.
*   Whether authentication, Firestore reads/writes, and callable functions succeed at runtime.
*   Whether the UI is correctly wired to every function under real emulator or deployed conditions.
*   Whether security rules are permissive, missing, or broken.
*   The presence of silent runtime errors, bad environment assumptions, or dead routes.

## PHASE 1 — REPO TRUTH MAP

- **`package.json`**: The root `package.json` defines a simple workspace structure with two packages: `functions` and `web`. It also contains scripts for managing the project, such as `dev`, `build`, `lint`, and `test`.
- **`pnpm-workspace.yaml`**: This file is not present in the repository, but the `package.json` file's `workspaces` field (`["functions", "web"]`) serves the same purpose for `pnpm`.
- **`firebase.json`**: This file configures Firebase hosting, functions, and emulators. It specifies that the `web/build` directory should be used for hosting, and that the functions are located in the `functions` directory.
- **`tsconfig.json`**: The root `tsconfig.json` is a base configuration for TypeScript. Each workspace (`functions` and `web`) has its own `tsconfig.json` that extends the root configuration.
- **`vite.config.ts`**: This file is located in the `web` directory and configures the Vite development server for the web application.
- **Apps/Packages**: The project is a monorepo with two main packages: `functions` (for Firebase Functions) and `web` (for the web application).
- **Canonical App**: The canonical web app is the Vite project in the `web` directory.
- **Scripts**:
    - `dev`: Runs `firebase emulators:start`, which should start the Firebase emulators for local development.
    - `build`: Runs `npm run build -w functions && npm run build -w web`, which should build both the functions and the web app.
    - `lint`: Runs `npm run lint -w functions && npm run lint -w web`, which should lint both workspaces.
    - `test`: Runs `npm run test -w functions && npm run test -w web`, which should run tests in both workspaces.

## PHASE 2 — CANONICAL PATH

**Execution Path (Based on Static Analysis)**:

1.  **`npm run dev`**: The developer starts the local development environment.
2.  **`firebase emulators:start`**: This command, executed by `npm run dev`, starts the Firebase emulators.
3.  **`web/src/main.tsx`**: The Vite development server serves the web application, with `main.tsx` as the entry point.
4.  **`App.tsx`**: This is the root component of the React application.
5.  **`routes`**: The application uses `react-router-dom` for routing. The routes are defined in `App.tsx` and include pages for home, jobs, dashboard, and authentication.
6.  **`page -> component -> function call`**: A user interacts with a page, which triggers a function call in a component. For example, a user clicking the "Apply" button on a job details page would trigger a function call.
7.  **`backend callable/http function`**: The function call in the component a Firebase Function. For example, applying for a job might call the `applyToJob` callable function.
8.  **`Firestore collection`**: The Firebase Function interacts with a Firestore collection to read or write data.

## PHASE 3 — LIVE SURFACE INVENTORY

| System | Status | Wired Into Live App? | Evidence | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Web app shell | PARTIAL | UNVERIFIED | `web/src/App.tsx`, `web/src/main.tsx` | The basic structure of a React app is present. |
| Routing | PARTIAL | UNVERIFIED | `web/src/App.tsx` | Routes for home, jobs, dashboard, and auth are defined. |
| Authentication | PARTIAL | UNVERIFIED | `web/src/pages/AuthPage.tsx`, `functions/src/index.ts` | Basic auth components and functions exist, but their correctness is unverified. |
| User profile creation | PARTIAL | UNVERIFIED | `web/src/pages/DashboardPage.tsx` | Profile creation seems to be part of the dashboard, but the flow is unclear. |
| Employer profile creation | PARTIAL | UNVERIFIED | `web/src/pages/DashboardPage.tsx` | Similar to user profile creation, this appears to be part of the dashboard. |
| Candidate profile creation | PARTIAL | UNVERIFIED | `web/src/pages/DashboardPage.tsx` | Similar to user profile creation, this appears to be part of the dashboard. |
| Job creation | PARTIAL | UNVERIFIED | `web/src/pages/DashboardPage.tsx`, `functions/src/index.ts` | A `createJob` function exists in the backend, and the dashboard seems to have a form for it. |
| Job update | STUBBED | UNVERIFIED | `functions/src/index.ts` | A `updateJob` function exists but the implementation is a placeholder. |
| Job listing/search/filtering | PARTIAL | UNVERIFIED | `web/src/pages/JobBoardPage.tsx` | The job board page fetches and displays jobs. Search and filtering are present but may not be fully functional. |
| Job detail page | PARTIAL | UNVERIFIED | `web/src/pages/JobDetailPage.tsx` | A component for displaying job details exists. |
| Job application flow | PARTIAL | UNVERIFIED | `web/src/pages/JobDetailPage.tsx`, `functions/src/index.ts` | An `applyToJob` function exists, and the UI has an apply button. |
| Dashboard | PARTIAL | UNVERIFIED | `web/src/pages/DashboardPage.tsx` | A dashboard page exists, but the data it displays is likely placeholder data. |
| Notifications/messages | NONE | N/A | | No evidence of a notification or messaging system. |
| File upload/resume upload | NONE | N/A | | No evidence of file or resume upload functionality. |
| AI recommendations | STUBBED | NO | `functions/src/ai.ts` | The `recommendJobs` function is a stub. |
| AI resume parser | STUBBED | NO | `functions/src/ai.ts` | The `parseResume` function is a stub. |
| AI matching | STUBBED | NO | `functions/src/ai.ts` | The `matchJob` function is a stub. |
| Firebase functions | PARTIAL | UNVERIFIED | `functions/src/index.ts` | Core CRUD functions are present but AI functions are stubs. |
| Firestore integration | PARTIAL | UNVERIFIED | `functions/src/index.ts` | Functions interact with Firestore, but the queries and data models are unverified. |
| Security rules | STUBBED | UNVERIFIED | `firestore.rules` | The security rules are permissive and not production-ready. |
| Emulator/dev flow | BROKEN | N/A | `package.json` | All attempts to run the local development environment have failed. |
| Build/deploy flow | BROKEN | N/A | `package.json` | The build process is failing. |

## PHASE 4 — FEATURE-BY-FEATURE VERIFICATION

| Feature | Status | File(s) | Evidence | Missing / Problems | Live or Dormant |
| :--- | :--- | :--- | :--- | :--- | :--- |
| User Authentication | PARTIAL | `web/src/pages/AuthPage.tsx`, `functions/src/index.ts` | The `onCall` function `createUser` exists. | The entire authentication flow is unverified. | Live |
| Job Creation | PARTIAL | `web/src/pages/DashboardPage.tsx`, `functions/src/index.ts` | The `createJob` function exists and is called from the dashboard. | Unverified. | Live |
| Job Listing | PARTIAL | `web/src/pages/JobBoardPage.tsx` | The `getJobs` function is called and jobs are displayed. | Filtering and search are likely not fully implemented. | Live |
| Job Application | PARTIAL | `web/src/pages/JobDetailPage.tsx`, `functions/src/index.ts` | The `applyToJob` function exists and is called from the job detail page. | Unverified. | Live |
| AI Job Recommendations | STUBBED | `functions/src/ai.ts` | The `recommendJobs` function is a placeholder. | The function is not implemented. | Dormant |
| AI Resume Parser | STUBBED | `functions/src/ai.ts` | The `parseResume` function is a placeholder. | The function is not implemented. | Dormant |
| AI Job Matching | STUBBED | `functions/src/ai.ts` | The `matchJob` function is a placeholder. | The function is not implemented. | Dormant |

## PHASE 5 — AI TRUTH TEST

All AI capabilities are **STUBBED**. The file `functions/src/ai.ts` contains placeholder functions that are not implemented.

-   **`recommendJobs`**: This function is a placeholder and does not contain any recommendation logic. It is not called anywhere in the web application.
-   **`parseResume`**: This function is a placeholder and does not contain any resume parsing logic. It is not called anywhere in the web application.
-   **`matchJob`**: This function is a placeholder and does not contain any job matching logic. It is not called anywhere in the web application.

There is no evidence of any LLM/provider API calls, embeddings/vector/search logic, scoring/ranking logic, or prompt files. The project's claims of being an "AI jobs platform" are entirely unsubstantiated by the code.

## PHASE 6 — EXECUTION REALITY CHECK

Execution of the project in its current state is **not possible**. All attempts to install, build, and run the project have failed.

-   `install`: **FAILS** (timeout)
-   `local dev startup`: **FAILS** (dependency installation fails)
-   `emulator startup`: **FAILS** (dependency installation fails)
-   `web startup`: **FAILS** (dependency installation fails)
-   `build`: **FAILS** (dependency installation fails)
-   `function compile`: **FAILS** (dependency installation fails)
-   `lint/typecheck`: **FAILS** (dependency installation fails)

**Core flows are NOT VERIFIED**

-   create user: **NOT VERIFIED**
-   create employer/candidate: **NOT VERIFIED**
-   create job: **NOT VERIFIED**
-   list jobs: **NOT VERIFIED**
-   open job detail: **NOT VERIFIED**
-   apply for job: **NOT VERIFIED**
-   dashboard load: **NOT VERIFIED**
-   recommended jobs load: **NOT VERIFIED**

Without a successful execution, the following remain entirely unknown:

-   The true behavior of the UI.
-   The correctness of the Firebase function wiring.
-   The validity of the Firestore data models and security rules.
-   The presence of any runtime errors.

## PHASE 7 — FIREBASE / DATA / SECURITY AUDIT

| Security Area | Status | Evidence | Risk |
| :--- | :--- | :--- | :--- |
| Firestore Rules | PARTIAL | `firestore.rules` | The rules appear to be structured correctly, but they are not production-ready. For example, the `jobs` collection is world-readable, and there are no restrictions on writes to the `messages` and `notifications` collections. |
| Callable Functions | PARTIAL | `functions/src/index.ts` | The callable functions have some authentication checks, but they are not comprehensive. For example, the `createUser` function does not require authentication. |
| User Isolation | PARTIAL | `firestore.rules` | The rules attempt to enforce user isolation, but the implementation is incomplete. For example, a user can read any job, regardless of who created it. |
| Role Boundaries | PARTIAL | `firestore.rules` | The rules define `isEmployer` and `isCandidate` functions, but they are not used consistently. For example, the `createJob` function does not check if the user is an employer. |

## PHASE 8 — DUPLICATION / CONFLICT / DEAD CODE

| Item | Type | Evidence | Recommendation |
| :--- | :--- | :--- | :--- |
| `functions/src/processJob.ts` | DEAD | File exists but is not imported or used anywhere. | `SAFE TO ARCHIVE` |
| `functions/src/retryFailedJob.ts` | DEAD | File exists but is not imported or used anywhere. | `SAFE TO ARCHIVE` |
| `functions/src/scheduledRetry.ts` | DEAD | File exists but is not imported or used anywhere. | `SAFE TO ARCHIVE` |
| `functions/src/verifyJob.ts` | DEAD | File exists but is not imported or used anywhere. | `SAFE TO ARCHIVE` |
| `web/src/pages/Admin.tsx` | DEAD | File exists but is not imported or used anywhere. | `SAFE TO ARCHIVE` |
| `web/src/pages/ApplySuccess.tsx` | DEAD | File exists but is not imported or used anywhere. | `SAFE TO ARCHIVE` |
| `web/src/pages/Referral.tsx` | DEAD | File exists but is not imported or used anywhere. | `SAFE TO ARCHIVE` |
| `web/src/pages/Waitlist.tsx` | DEAD | File exists but is not imported or used anywhere. | `SAFE TO ARCHIVE` |
| `web/src/pages/Jobs.tsx` | DUPLICATE | `web/src/pages/JobBoard.tsx` appears to be the canonical job listing page. | `REQUIRES MANUAL REVIEW` |
| `web/src/firebase.ts` | DUPLICATE | `web/src/lib/firebase.ts` appears to be the canonical Firebase initialization. | `REQUIRES MANUAL REVIEW` |
| `URAI_ECOSYSTEM_ROADMAP.md` | MISLEADING DOC | This document may contain claims that are not reflected in the current state of the project. | `REQUIRES MANUAL REVIEW` |

## PHASE 9 — DOC CLAIM VERIFICATION

| Doc / Claim | Claim Summary | Verified? | Evidence | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| URAI_ECOSYSTEM_ROADMAP.md | User authentication is complete. | NO | The roadmap claims that user authentication is complete, but the `createUser` function does not require authentication. | `FALSE` |
| URAI_ECOSYSTEM_ROADMAP.md | Job board is partially complete. | YES | The job board is partially implemented, but it is not fully functional. | `PARTIALLY TRUE` |
| URAI_ECOSYSTEM_ROADMAP.md | Job application is planned. | YES | The `applyToJob` function exists, but it is not fully implemented. | `PARTIALLY TRUE` |
| URAI_ECOSYSTEM_ROADMAP.md | User dashboards are planned. | YES | The dashboard page exists, but it is not fully implemented. | `PARTIALLY TRUE` |
| URAI_ECOSYSTEM_ROADMAP.md | AI features are stubbed. | YES | The AI functions in `functions/src/ai.ts` are all stubs. | `TRUE` |

## PHASE 10 — PRODUCTION READINESS

- **Builds now?** NO.
- **Runs now?** NO.
- **Deploy-ready?** NO.
- **Secure enough for real users?** NO. The `firestore.rules` are permissive, and the callable functions have incomplete authentication checks.
- **Credible enough for demo?** NO. The application is not runnable, and the core AI features are stubbed.
- **Credible enough for paying customers?** NO.
- **Blocked by what exactly?** The project is blocked by a broken local development environment, which prevents any runtime verification. Beyond that, it is blocked by incomplete features, stubbed AI, and significant security vulnerabilities.
- **What is unknown without runtime proof?** Everything. The true behavior of the UI, the correctness of the Firebase function wiring, the validity of the Firestore data models and security rules, and the presence of any runtime errors are all unknown.

## PHASE 11 — ROADMAP TRUTH EXTRACTION

- **Planned:** Job application, user dashboards, advanced search and filtering, company profiles, and candidate profiles are all claimed as planned but exist in various states of partial implementation.
- **Partial:** The job board is the most complete feature, but it is still only partially functional.
- **Aspirational:** Immersive spatial systems (V4) and advanced AI narrative (V5) are purely aspirational and have no code to back them up.
- **Abandoned:** The dead files identified in Phase 8 (`Admin.tsx`, `Referral.tsx`, etc.) likely represent abandoned features.

## PHASE 12 — FREEZE-AND-REPAIR PLAN

**Priority 0 — Must fix before trusting audit claims**

- **Problem:** Broken local development environment.
- **Evidence:** All `npm` scripts fail due to timeouts during dependency installation (Phase 6).
- **Impact:** It is impossible to run or verify any part of the application, making any further development or audit impossible.
- **Exact Repair Target Files:** `package.json` (root, `web`, and `functions`), `pnpm-lock.yaml`.
- **Action:** Repair.

**Priority 1 — Must fix before internal demo**

- **Problem:** Incomplete and insecure core user flows.
- **Evidence:** `createUser` function does not require authentication, and `createJob` does not check if the user is an employer (Phase 7). `firestore.rules` are permissive.
- **Impact:** The application is fundamentally insecure and non-functional for its primary purpose.
- **Exact Repair Target Files:** `functions/src/index.ts`, `firestore.rules`.
- **Action:** Repair.

- **Problem:** Stubbed AI features are presented as real.
- **Evidence:** All functions in `functions/src/ai.ts` are placeholders (Phase 5).
- **Impact:** This is misleading to stakeholders and creates false confidence in the project's capabilities.
- **Exact Repair Target Files:** `functions/src/ai.ts` and all UI components that reference AI functionality.
- **Action:** Quarantine (re-label in UI as "Coming Soon" or disable).

**Priority 2 — Must fix before external demo**

- **Problem:** Dead and duplicate code.
- **Evidence:** A significant number of files are either unused or duplicates (Phase 8).
- **Impact:** The repository is confusing, difficult to maintain, and gives a false impression of the project's size and complexity.
- **Exact Repair Target Files:** All files listed in the Phase 8 table.
- **Action:** Archive or Remove.

**Priority 3 — Must fix before production**

- **Problem:** Lack of tests.
- **Evidence:** There are no tests in the repository.
- **Impact:** There is no way to prevent regressions or automatically verify functionality.
- **Exact Repair Target Files:** New test files will need to be created in the `functions` and `web` packages.
- **Action:** Repair (by adding tests).

**Priority 4 — Cleanup / archive / tech debt**

- **Problem:** Misleading documentation.
- **Evidence:** `URAI_ECOSYSTEM_ROADMAP.md` contains false and misleading claims about the project's status (Phase 9).
- **Impact:** New developers and stakeholders will be misinformed about the state of the project.
- **Exact Repair Target Files:** `URAI_ECOSYSTEM_ROADMAP.md`.
- **Action:** Rewrite or Archive.

## 17. Final Hard Verdict

**What is actually real today:** A project structure with a broken dependency configuration. The *idea* of a job board is present in the form of file names and static code, but none of it is executable.

**What only looks real:** The entire application. The file structure and code give the appearance of a working application, but this is an illusion. The AI features are explicitly fake.

**What is missing:** A working development environment, implemented core features, basic security, tests, and any real AI functionality.

**What should happen next before any new feature work:** The freeze-and-repair plan must be executed, starting with fixing the broken local development environment. Until the command `npm install` runs successfully, no other progress can be made.
