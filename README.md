# URAI-Jobs: Hiring & Applicant Tracking System

URAI-Jobs is a complete, production-ready hiring, applicant tracking, waitlist, and referrals system for URAI Labs.

This project is built on a modern serverless stack using Firebase Hosting for the frontend SPA and Cloud Functions for the backend, with Firestore as the database and Firebase Storage for resume uploads.

## Features

- **Public Job Board**: A clean, mobile-first interface for browsing and applying for open positions.
- **Applicant Tracking**: A protected admin console for managing jobs, viewing applicants, changing application statuses, and adding internal notes.
- **Secure Resume Uploads**: Applicants can upload resumes directly, which are stored securely and are only accessible by administrators.
- **Referral System**: Built-in support for referral codes to track application sources.
- **Developer Waitlist**: A simple form to collect interest from potential future candidates.
- **Automated Workflows**: Cloud Functions handle data synchronization, event tracking, and scheduled tasks.
- **Strict Security**: Comprehensive Firestore and Storage security rules to protect user data and ensure system integrity.
- **Ready to Deploy**: The entire system can be set up and deployed with a single script.

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Backend**: Node.js (v20) with TypeScript on Cloud Functions for Firebase
- **Database**: Cloud Firestore
- **Storage**: Cloud Storage for Firebase
- **Deployment**: Firebase Hosting (SPA) & Cloud Functions

## Local Development Setup

Follow these steps to get the project running locally with the Firebase Emulators.

### Prerequisites

1.  **Node.js**: Ensure you have Node.js version 20.x or higher installed.
2.  **pnpm**: This project uses `pnpm` for package management. Install it globally:
    ```bash
    npm install -g pnpm
    ```
3.  **Firebase CLI**: You need the Firebase CLI installed and authenticated.
    ```bash
    npm install -g firebase-tools
    firebase login
    ```

### 1. Project Configuration

Ensure you have access to the `urai-jobs` Firebase project.

If you haven't already, associate the local project with your Firebase project:

```bash
firebase use --add
# Select 'urai-jobs' from the list
```

### 2. Install Dependencies

Install all dependencies for the root, `web`, and `functions` workspaces:

```bash
pnpm install
```

### 3. Run Emulators

Start the Firebase Local Emulator Suite. This will emulate Hosting, Functions, Firestore, and Storage.

```bash
pnpm run emulators
```

The emulators will start, and you can view the Emulator UI at [http://127.0.0.1:4000](http://127.0.0.1:4000).

### 4. Seed the Database

In a new terminal window, run the seed script to populate the emulated Firestore database with sample data (jobs, applicants, etc.).

```bash
pnpm run seed
```

### 5. Run the Web Development Server

Finally, start the Vite development server for the frontend application:

```bash
pnpm run dev
```

The web application will be available at [http://localhost:5173](http://localhost:5173) and will connect to the local Firebase emulators.

## Build and Deploy

### Build the Project

To build the frontend application and the Cloud Functions, run:

```bash
pnpm run build
```

This command transpiles the TypeScript functions into JavaScript and builds the React application, placing the output in the `/public` directory for hosting.

### Deploy to Firebase

To deploy the entire project (Hosting, Functions, Firestore Rules, Storage Rules), you can use the standard Firebase deploy command:

```bash
firebase deploy
```

Alternatively, you can use the provided finisher script, which includes preflight checks, building, and a post-deploy smoke test:

```bash
./urai_jobs_finish.sh
```

This script ensures a safe and complete deployment and is the recommended method for releases.

## Available Scripts

-   `pnpm dev`: Starts the web dev server and emulators concurrently.
-   `pnpm build`: Builds both the web app and functions.
-   `pnpm emulators`: Starts the Firebase Emulator Suite.
-   `pnpm seed`: Populates the emulated database with test data.
-   `pnpm test`: Runs the Firestore security rules tests.
