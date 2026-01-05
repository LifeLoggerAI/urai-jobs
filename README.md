# URAI-Jobs

URAI-Jobs is a complete hiring, applicant tracking, waitlist, and referrals system for URAI Labs. It is a production-ready application built on the Firebase platform, featuring a static single-page application (SPA) frontend and a serverless backend using Cloud Functions.

## Technology Stack

- **Frontend:** Vite + React + TypeScript
- **Backend:** Node.js (v20) + TypeScript + Cloud Functions for Firebase
- **Database:** Cloud Firestore
- **Storage:** Cloud Storage for Firebase
- **Deployment:** Firebase Hosting

## Project Structure

```
.
├── functions/      # Cloud Functions (Node.js + TypeScript)
├── public/         # Build output for the frontend SPA
├── web/            # Frontend source code (Vite + React + TypeScript)
├── .firebaserc     # Firebase project configuration
├── firebase.json   # Firebase services configuration
├── firestore.rules # Firestore security rules
├── storage.rules   # Cloud Storage security rules
└── README.md
```

## Local Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later)
- [Firebase CLI](https://firebase.google.com/docs/cli) (latest version)
- A Firebase project

### 1. Clone the repository

```bash
git clone <repository-url>
cd urai-jobs
```

### 2. Install dependencies

This project is a monorepo using npm workspaces. Install all dependencies from the root directory.

```bash
npm install
```

### 3. Configure Firebase Project

Set up the Firebase project you want to use for development and deployment.

```bash
# List your Firebase projects
firebase projects:list

# Set the active project
firebase use <your-firebase-project-id>
```

### 4. Configure Environment Variables

The web application requires Firebase configuration to be available as environment variables. Create a `.env` file in the `web/` directory:

```bash
# create web/.env
cp web/.env.example web/.env
```

Now, edit `web/.env` and fill in your Firebase project's configuration. You can find these values in the Firebase console under Project settings > General.

```env
VITE_API_KEY=...
VITE_AUTH_DOMAIN=...
VITE_PROJECT_ID=...
VITE_STORAGE_BUCKET=...
VITE_MESSAGING_SENDER_ID=...
VITE_APP_ID=...
```

## Running Locally

To run the full application stack locally, you need to run the Firebase Emulators and the web development server concurrently.

### 1. Run Firebase Emulators

The emulators simulate Firebase services (Auth, Firestore, Functions, Storage) on your local machine.

```bash
npm run emulators
```

### 2. Seed the Database

To populate the local Firestore emulator with sample data, run the seed script.

```bash
npm run seed
```

This will create sample jobs, applicants, and other data for testing.

### 3. Run the Web Development Server

In a separate terminal, start the Vite development server for the frontend application.

```bash
npm run dev:web
```

The web app will be available at `http://localhost:5173`.

## Building for Production

To build the frontend and backend for production, run the following command from the root directory:

```bash
npm run build
```

This command will:
1.  Build the React application and output the static files to the `/public` directory.
2.  Transpile the Cloud Functions TypeScript code into JavaScript in the `functions/lib` directory.

## Deployment

To deploy the application to Firebase, run the following command:

```bash
firebase deploy
```

This will deploy:
-   **Hosting:** The static web application from the `/public` directory.
-   **Functions:** All Cloud Functions from the `functions/` directory.
-   **Firestore Rules:** The rules defined in `firestore.rules`.
-   **Storage Rules:** The rules defined in `storage.rules`.

Make sure you have selected the correct Firebase project using `firebase use` before deploying.

## Firestore Data Model

-   `jobs`: Job postings (private admin view).
-   `jobPublic`: Publicly visible job postings.
-   `applicants`: Candidate profiles.
-   `applications`: Job applications.
-   `referrals`: Referral codes and stats.
-   `waitlist`: Users who signed up for the waitlist.
-   `admins`: Firestore-based admin allowlist.
-   `events`: Basic event tracking for analytics.

## Cloud Functions

-   `onJobWrite`: Keeps `jobPublic` in sync with `jobs`.
-   `onApplicationCreate`: Handles applicant creation and updates job stats.
-   `createResumeUpload`: Generates a signed URL for resume uploads.
-   `adminSetApplicationStatus`: Admin-only callable function to update application status.
-   `scheduledDailyDigest`: Scheduled function to generate daily summaries.
-   `httpHealth`: A simple HTTP function to check the health of the functions deployment.

## Security

-   **Firestore Rules (`firestore.rules`):** Strictly configured to protect user data. Public access is limited to the `jobPublic` collection.
-   **Storage Rules (`storage.rules`):** Resumes are private and can only be read by admins. Applicants can only upload to their own scoped path.
