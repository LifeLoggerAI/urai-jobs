# URAI Jobs - Current Status

## 1. What exists and works

*   **Firebase Project Structure:** `firebase.json` is well-configured for functions, hosting, and emulators.
*   **Firestore Security Rules:** `firestore.rules` are well-defined, enforcing good security practices.
*   **Firestore Indexes:** `firestore.indexes.json` is in place with indexes for common queries.
*   **Backend `createJob` Function:** `functions/src/jobs/createJob.ts` is well-implemented with validation, transactional writes, and ownership assignment.
*   **Shared Types:** A `shared-types` package exists, which is a good practice for ensuring consistency between the frontend and backend.
*   **Frontend Routing:** The React app has basic routing with protected routes for authenticated users and admins.
*   **Frontend `CreateJobPage`:** The `CreateJobPage` is functional and calls the `createJob` backend function.
*   **Role-Based Access Control (RBAC):** The backend has a basic RBAC system in place.

## 2. What is partial

*   **Shared Types:** The shared types in `packages/shared-types/src/index.ts` have some inconsistencies and could be improved. The `Job` type has both `jobType` and `type`, which is redundant. Some fields that should be required are optional.
*   **Frontend UI:** The frontend is functional but very basic. There are no pages for listing jobs, viewing job details, or a proper admin dashboard. The UI lacks proper styling and user experience considerations.
*   **Worker Implementation:** The worker implementation has not yet been inspected.
*   **Backend Functions:** Only the `createJob` function has been inspected in detail. Other functions like `listJobs`, `getJob`, `getMyJobs`, `retryJob`, and `cancelJob` are mentioned in `functions/src/index.ts` but their implementation has not been checked.
*   **Error Handling:** The frontend has basic error handling, but it could be more robust and user-friendly.

## 3. What is broken

*   **Inconsistent File Extensions:** There are both `.js` and `.ts` (or `.tsx`) files in the `functions` and `web` directories. This indicates an incomplete migration to TypeScript or a messy codebase. The imports in `functions/src/index.ts` and other files also use the `.js` extension, which is incorrect for a TypeScript project.

## 4. What is missing

*   **Comprehensive Job Lifecycle Management:** The backend functions for listing, getting, retrying, and canceling jobs are not fully verified.
*   **Polished Frontend:** The frontend is missing key pages and features, such as a "My Jobs" page, a "Job Detail" page, a proper admin dashboard, and a landing page.
*   **Worker Implementation details:** The worker implementation is still a black box.
*   **System-of-Systems Job Types:** Support for the full list of job types from `docs/URAI_JOBS_INTEGRATION_CONTRACTS.md` is not verified.
*   **Smoke Tests and E2E Checks:** The `scripts` for verification and smoke tests are mentioned in the root `package.json` but have not been inspected.
*   **Documentation:** The `docs/URAI_JOBS_INTEGRATION_CONTRACTS.md` file has not been inspected.

## 5. Which Firebase resources are used

*   Cloud Functions
*   Cloud Firestore
*   Firebase Hosting
*   Firebase Authentication

## 6. Which routes exist

*   `/` (Welcome page)
*   `/login`
*   `/signup`
*   `/create` (Protected)
*   `/admin` (Protected)
*   `/unauthorized`

## 7. Which functions exist (from `functions/src/index.ts`)

*   `createJob`
*   `getJobStatus`
*   `cancelJob`
*   `executeJob`
*   `processQueueTick`
*   `retryExpiredLeases`
*   `cleanupTerminalJobs`
*   `systemReconcile`
*   `onJobTerminalEvent`

## 8. Which job types exist (from `CreateJobPage.tsx`)

*   `narrator.tts` (as an example)

## 9. Which workers exist

*   Not yet inspected.

## 10. Which systems are still mocked

*   The full extent of mocking is not yet clear, but the frontend is clearly not showing real data from the backend (except for the `createJob` function).

## 11. Exact next implementation checklist

1.  **Fix inconsistent file extensions and imports:** Clean up the codebase to use TypeScript consistently.
2.  **Complete and verify backend functions:** Implement and test `listJobs`, `getJob`, `getMyJobs`, `retryJob`, and `cancelJob`.
3.  **Improve shared types:** Refine the data models in the `shared-types` package.
4.  **Build out the frontend:** Create the missing pages and components, and improve the overall user experience.
5.  **Inspect and complete worker implementation:** Verify that the workers are correctly processing jobs.
6.  **Implement system-of-systems job types:** Add support for all the required job types.
7.  **Create smoke tests and E2E checks:** Implement the verification and smoke test scripts.
8.  **Review and update documentation:** Ensure that the `docs/URAI_JOBS_INTEGRATION_CONTRACTS.md` is accurate and up-to-date.
9.  **Perform a full build and test run:** Run all the necessary commands to ensure that the project is in a good state.
10. **Create the final proof files.**
