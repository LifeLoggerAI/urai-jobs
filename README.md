# URAI-Jobs

A full-stack hiring and applicant tracking system built with Firebase.

## Project Overview

This project provides a complete solution for managing job openings, accepting applications, and tracking candidates through the hiring process. It includes a public-facing job board, a private admin console, and a secure backend built with Cloud Functions and Firestore.

## Features

- **Job Board:** A public-facing list of open positions.
- **Application Form:** A simple and user-friendly application form with resume upload.
- **Admin Console:** A protected area for managing jobs, applicants, and applications.
- **Secure Backend:** Cloud Functions and Firestore are used to provide a secure and scalable backend.
- **Automated Workflows:** Cloud Functions are used to automate tasks such as creating public job postings and sending notifications.

## Local Setup

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up Firebase:**

   - Create a new Firebase project.
   - Copy `.firebaserc.example` to `.firebaserc` and replace `your-project-id` with your Firebase project ID.

## Running the Emulators

To run the Firebase emulators, use the following command:

```bash
npm run emulators
```

This will start the Firestore, Functions, and Hosting emulators.

## Seeding the Database

To seed the database with sample data, use the following command:

```bash
npm run seed
```

This will populate the Firestore database with a set of jobs, applicants, applications, referral codes, and waitlist entries.

## Running the Web App

To run the web app in development mode, use the following command:

```bash
npm run dev
```

This will start the Vite development server and the Firebase emulators.

## Deploying the Application

To deploy the application to Firebase, use the following command:

```bash
firebase deploy
```

This will deploy the Hosting, Functions, and Firestore rules to your Firebase project.
