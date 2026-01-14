# URAI-JOBS: Production-Ready Hiring System

This project provides a complete, production-grade hiring and applicant tracking system built on Firebase.

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Firebase CLI (`npm install -g firebase-tools`)

## 1. Local Setup

a. **Install dependencies from the root:**

   ```bash
   pnpm install
   ```

b. **Configure Firebase for the web app:**

   - Create `web/.env.local` from `web/.env.example`.
   - Go to your Firebase project settings.
   - Under "Your apps", select your web app.
   - Choose "Config" for SDK setup and configuration.
   - Copy the `firebaseConfig` object values into your `web/.env.local` file.

c. **Login to Firebase:**

   ```bash
   firebase login
   ```

d. **Set active Firebase project:**

   ```bash
   firebase use <your-firebase-project-id>
   ```

## 2. Run Locally

This single command starts the Vite development server for the web app, the TypeScript compiler in watch mode for Cloud Functions, and the full Firebase emulator suite.

```bash
pnpm dev
```

- **Web App:** [http://localhost:3000](http://localhost:3000)
- **Emulators UI:** [http://localhost:4000](http://localhost:4000)

## 3. Seed Database

To populate the local Firestore emulator with realistic sample data, open a **new terminal** and run:

```bash
pnpm seed
```

This will create jobs, applicants, applications, and more, which you can view in the Emulator UI.

## 4. Testing

The test suite runs against the Firebase emulators to validate Firestore security rules and Function behavior.

```bash
# Ensure emulators are running before executing tests
# You can use `pnpm dev` in another terminal
pnpm test
```

## 5. Deployment

This command performs a full production build and deploys all necessary Firebase services.

```bash
pnpm deploy
```

This will:
1.  Build the web app and Cloud Functions.
2.  Deploy Hosting, Functions, Firestore rules/indexes, and Storage rules.

## 6. Verifying the Deployment

- **Health Check:** After deployment, get your cloud function URL for `adminJobApi` from the Firebase console and you can test the callable function.
- **Job Board:** Visit your Firebase Hosting URL to see the live job board.
