# URAI-JOBS ARCHITECTURE

This document outlines the architecture of the URAI-JOBS project.

## Layers

*   **Frontend Application:** A React-based single-page application built with Vite.
*   **Admin/Employer Dashboard:** A dedicated interface for administrative or employer-specific functionalities.
*   **Applicant Portal:** A portal for job applicants to search for and apply to jobs.
*   **API/Server Layer:** TypeScript-based Cloud Functions that serve as the backend logic for the application.
*   **Firebase Services:** The project utilizes various Firebase services, including Firestore, Hosting, Storage, and Functions.
*   **Firestore Data Layer:** Firestore is used as the database, with schema and rules defined in `firestore.rules` and indexes in `firestore.indexes.json`.
