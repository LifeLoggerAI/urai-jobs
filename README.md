# URAI-Jobs System

This project is a durable, Firestore-based job queue system for orchestrating back-end tasks like rendering "Life Movies". It is designed to be robust, scalable, and observable.

## Project Structure

-   `/functions`: Contains all Cloud Functions code written in TypeScript.
    -   `src/v1`: HTTP-triggered functions for the public API (e.g., submitting jobs).
    -   `src/triggers`: Firestore-triggered functions for job orchestration.
    -   `src/lib`: Shared libraries for Firebase, etc.
    -   `src/types`: Zod schemas for data validation.
-   `/web`: A minimal Vite + React frontend. The build output is directed to `/public`.
-   `/public`: Static assets served by Firebase Hosting.
-   `firebase.json`: Configuration for all Firebase services.
-   `firestore.rules`: Security rules for the database.
-   `storage.rules`: Security rules for file storage.

## How it Works

1.  **Job Submission**: An HTTP request to the `/v1/render` endpoint creates a new job document in the `jobs` collection with a status of `new`.
2.  **Orchestration**: A Firestore trigger (`triggers.onJobUpdate`) listens for changes to job documents and moves the job through its lifecycle (`queued` -> `rendering` -> `uploaded` -> `published`).
3.  **Artifacts**: During the `rendering` phase, a stub artifact is created in Cloud Storage. In a real-world scenario, this would be replaced by a call to an external rendering service.
4.  **Security**: Firestore and Storage rules ensure that only authenticated users and backend processes have appropriate access.

## Local Development

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Run Emulators

This command starts the local Firebase emulators for Functions, Firestore, Hosting, and Storage.

```bash
pnpm dev
```

The above command is a shortcut for `concurrently "pnpm --filter web dev" "firebase emulators:start"`, which runs the web dev server and emulators at the same time.

### 3. Run Tests

Run all unit tests for the functions.

```bash
pnpm test --filter functions
```

## Deployment

Deploy all services (Functions, Firestore rules, Storage rules, Hosting) to your active Firebase project.

```bash
pnpm deploy
```
