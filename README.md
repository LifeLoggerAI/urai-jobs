# URAI-JOBS

This is a full-stack hiring and applicant tracking system built with Firebase, React, and TypeScript.

## Project Structure

- `functions/`: Cloud Functions (Node.js, TypeScript)
- `web/`: React frontend (Vite, TypeScript)
- `packages/`: Shared TypeScript types and utilities
- `firestore.rules`: Firestore security rules
- `storage.rules`: Cloud Storage security rules
- `firebase.json`: Firebase project configuration

## Local Setup

1.  **Install Dependencies:**

    ```bash
    npm install
    ```

2.  **Set up Firebase Emulators:**

    Make sure you have the Firebase CLI installed and configured. Then, run:

    ```bash
    firebase setup:emulators:firestore
    firebase setup:emulators:storage
    firebase setup:emulators:auth
    ```

3.  **Run Emulators:**

    ```bash
    npm run emulators
    ```

4.  **Run Web Development Server:**

    In a separate terminal, run:

    ```bash
    npm run dev
    ```

    This will start the Vite development server, and you can access the application at `http://localhost:5173`.

## Seeding the Database

To populate the Firestore emulator with sample data, run the following command in a separate terminal while the emulators are running:

```bash
npm run seed
```

This will create sample jobs, applicants, and applications.

## Deployment

To deploy the application to Firebase Hosting and Cloud Functions, run:

```bash
firebase deploy
```

This will:

1.  Build the frontend application and deploy it to Firebase Hosting.
2.  Deploy the Cloud Functions.
3.  Deploy the Firestore and Storage rules.
