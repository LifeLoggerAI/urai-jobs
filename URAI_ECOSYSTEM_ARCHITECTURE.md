
# URAI Ecosystem Architecture

## Global Project Map

The URAI ecosystem is a monorepo containing the following projects:

*   **`web`**: A React-based frontend application that serves as the user interface for the URAI Job Marketplace.
*   **`functions`**: A Node.js and TypeScript-based serverless backend that runs on Firebase Functions and powers the job marketplace.

### Relationships

*   The `web` project is a frontend application that communicates with the `functions` backend via HTTPS callable functions.
*   Both projects are part of the same Firebase project and share the same Firebase services (Authentication, Firestore, Storage).
*   The root `package.json` manages both projects as workspaces, allowing for unified build and linting commands.

## Platform Architecture

The URAI platform is built on a classic client-server architecture with a web-based frontend and a serverless backend, all hosted on Firebase.

### Layers

*   **User-facing applications**: This layer consists of the `web` project, which is a React-based single-page application that provides the user interface for the URAI Job Marketplace. This is the primary entry point for users to interact with the platform.
*   **Job marketplace systems**: This layer is powered by the `functions` project, which is the serverless backend built with Firebase Functions. It handles business logic such as creating and managing users, jobs, and applications.
*   **Shared infrastructure services**: The entire platform is built on top of Firebase, which provides the following services:
    *   **Firebase Authentication**: For user sign-up and sign-in.
    *   **Firestore**: A NoSQL database for storing all platform data, such as user profiles, jobs, and applications.
    *   **Cloud Functions**: For running the backend logic.
    *   **Firebase Hosting**: For hosting the `web` application.
    *   **Cloud Storage for Firebase**: For storing user-uploaded files, such as resumes.
