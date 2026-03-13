# URAI-JOBS

This project is the distributed task execution layer for the URAI ecosystem. It is designed to accept jobs from other URAI services, queue them, process them asynchronously, and record results and logs with reliable retry handling.

## Project Structure

- `functions/`: Cloud Functions (Node.js, TypeScript) for all backend logic.
- `firestore.rules`: Firestore security rules.
- `storage.rules`: Cloud Storage security rules (if needed).
- `firebase.json`: Firebase project configuration.

## System Architecture

URAI-Jobs functions as the asynchronous compute backbone for the entire URAI architecture, enabling other subsystems to offload heavy computation.

### Core Components

-   **API:** A set of HTTP endpoints for enqueuing jobs and checking their status.
-   **Job Queue:** A Firestore-based queue that holds jobs to be processed.
-   **Workers:** Cloud Functions that are triggered to process jobs from the queue.
-   **Retry Logic:** A mechanism for automatically retrying failed jobs.

### Data Model (Firestore Collections)

-   **`jobs`**: Stores submitted tasks with their current status, priority, and retry information.
-   **`jobQueues`**: Tracks the state and priority of different job queues.
-   **`jobResults`**: Contains the output from successfully completed jobs.
-   **`jobLogs`**: Provides detailed operational logging for diagnostics and auditing.

## Local Setup

1.  **Install Dependencies:**

    ```bash
    npm install
    ```

2.  **Run Emulators:**

    Make sure you have the Firebase CLI installed.

    ```bash
    firebase emulators:start
    ```

## Deployment

To deploy the functions and rules:

```bash
firebase deploy
```
