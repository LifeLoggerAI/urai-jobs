# URAI-Jobs

A hiring + applicant tracking + waitlist + referrals system for URAI Labs / URAI.

## Local Setup

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Install project dependencies: `npm install`
3. Install functions dependencies: `cd functions && npm install && cd ..`
4. Create a service account in the Firebase console and download the `serviceAccountKey.json` file to the root of the project.

## Run Emulators

`npm run emulators`

## Seed Data

`npm run seed`

## Run Web Dev Server

`npm run dev`

## Deploy

`firebase deploy`
