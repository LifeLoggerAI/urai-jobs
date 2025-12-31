# URAI-Jobs

This project is a hiring, applicant tracking, waitlist, and referrals system for URAI Labs / URAI.

## Local Setup

1.  **Install Dependencies:**

    ```bash
    npm install
    cd functions && npm install && cd ..
    cd web && npm install && cd ..
    ```

2.  **Set up Firebase Emulators:**

    Make sure you have the Firebase CLI installed. If not, run:

    ```bash
    npm install -g firebase-tools
    ```

    Then, set up the emulators:

    ```bash
    firebase setup:emulators:firestore
    firebase setup:emulators:storage
    firebase setup:emulators:auth
    firebase setup:emulators:functions
    ```

## Running the Project

1.  **Start the Emulators:**

    ```bash
    firebase emulators:start
    ```

2.  **Run the Seed Script:**

    In a new terminal, run:

    ```bash
    npm run seed
    ```

3.  **Start the Web Server:**

    In another new terminal, run:

    ```bash
    cd web && npm run dev
    ```

    The application will be available at `http://localhost:5173`.

## Deployment

To deploy the project to Firebase, run:

```bash
firebase deploy
```
