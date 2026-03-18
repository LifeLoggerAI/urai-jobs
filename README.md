
# URAI-JOBS

## A Simple Job Board Application

This is a prototype job board application built with React, Vite, and Firebase. It allows users to sign up, create a profile, post jobs, and apply for jobs.

**This project is currently in a "freeze-and-repair" phase. The previous documentation was inaccurate. This README reflects the actual state of the project.**

### Current Features

*   **Authentication:** Users can create an account and log in.
*   **Job CRUD:** Users can create, read, update, and delete job postings.
*   **Job Application:** Users can apply for jobs.
*   **Dashboard:** A simple dashboard that displays the latest jobs.

### Aspirational Features (Currently Stubbed)

The following features are present in the codebase as stubs but are **not functional**:

*   **AI Job Recommendations:** The "Recommended Jobs" feature is a placeholder and currently just shows the latest jobs.
*   **AI Resume Parser:** The resume parsing functionality is a placeholder and does not work.
*   **AI Job Matcher:** The job matching functionality is a placeholder and does not work.

### How to Run Locally

1.  **Install Dependencies:**
    ```bash
    pnpm install
    ```

2.  **Run in Development Mode:**
    This command will start the Firebase emulators and the Vite development server for the web app.
    ```bash
    pnpm run dev
    ```

### What's Next

The immediate priority is to stabilize the existing features, add tests, and harden the security. No new features will be added until the core application is stable and reliable.
