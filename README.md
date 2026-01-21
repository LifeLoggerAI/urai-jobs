# URAI Jobs

This project is a hiring, applicant tracking, waitlist, and referrals system for URAI Labs / URAI.

## Local Setup

1. Install pnpm: `npm install -g pnpm`
2. Install dependencies: `pnpm install`

## Running Emulators

```bash
pnpm emulators
```

This will start the Firebase emulators for Firestore, Functions, and Pub/Sub.

## Seeding Data

To seed the database with test data, run the following command:

```bash
pnpm --filter urai-jobs-cli smoke
```

## Running the Web App

This project does not yet have a web app. It is a backend-only system.

## Deploying

1. Login to Firebase: `firebase login`
2. Set the project: `firebase use <your-project-id>`
3. Set the project ID config: `firebase functions:config:set gcloud.project=<your-project-id>`
4. Deploy: `pnpm deploy`

This will deploy the Cloud Functions and Firestore rules.
