# URAI-Jobs

A hiring + applicant tracking + waitlist + referrals system for URAI Labs / URAI.

## Local Setup

1.  **Install dependencies:**

    ```bash
    npm install
    ```

2.  **Set up Firebase emulators:**

    - Create a `serviceAccountKey.json` file in the root of the project.
    - Run the following command to start the emulators:

      ```bash
      npm run emulators
      ```

3.  **Seed the database:**

    ```bash
    npm run seed
    ```

4.  **Run the web app:**

    ```bash
    npm run dev
    ```

## Deployment

To deploy the project to Firebase, run the following command:

```bash
npm run deploy
```
