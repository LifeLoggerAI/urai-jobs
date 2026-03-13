# URAI-Jobs: Applicant Data Flow Diagram

This document outlines the flow of applicant data, including Personally Identifiable Information (PII), through the URAI-Jobs system. The diagram and explanations are crucial for understanding the data lifecycle and ensuring the security and privacy of applicant information.

## 1. Data Flow Diagram (Mermaid Syntax)

```mermaid
graph TD
    A[Applicant on uraijobs.com/apply/:jobId] -- 1. Fills Form --> B{Frontend SPA (React)};
    B -- 2. Attaches Resume --> B;
    B -- 3. Submits Application --> C{Cloud Function: createResumeUpload};

    subgraph "Secure Backend (Firebase)"
        C -- 4. Validates Request & PII --> D[Firestore: Create Application Doc];
        C -- 5. Generates Signed URL --> B;
        D -- Firestore Trigger --> F{Cloud Function: onApplicationCreate};
        F -- Updates Stats --> G[Firestore: Job Stats];
        B -- 6. Uploads Resume via Signed URL --> E{Google Cloud Storage};
    end

    subgraph "Admin Access"
        H[Admin on uraijobs.com/admin] -- 7. Views Applicant List --> I{Cloud Function: getApplicants};
        I -- Reads Firestore --> D;
        H -- 8. Requests Resume --> J{Cloud Function: getResume};
        J -- Generates Signed Read URL --> H;
        H -- 9. Downloads Resume --> E;
    end

    A --> K[Event Tracking: Firestore `events` collection]

    style E fill:#f9f,stroke:#333,stroke-width:2px
    style D fill:#f9f,stroke:#333,stroke-width:2px
```

## 2. Stages of Data Flow

### Stage 1: Application Submission (Public-Facing)

1.  **Applicant Fills Form**: The applicant navigates to a public job application page and enters their information (name, email, etc.) into a React form.
2.  **Resume Attachment**: The applicant selects a resume file (PDF, DOCX, etc.) from their local machine. The file is held in the browser's memory.
3.  **Submit Action**: Upon clicking "Submit," the frontend application first calls the `createResumeUpload` Cloud Function, sending the application metadata (but not the resume file itself).

### Stage 2: Secure Backend Processing (Serverless)

4.  **Backend Validation & Doc Creation**: The `createResumeUpload` function validates the incoming data (e.g., checking for required fields, validating email format). It then creates a new document in the `/orgs/{orgId}/applications` collection in Firestore with the applicant's information and an initial status of "NEW".
5.  **Signed URL Generation**: After successfully creating the application document, the same Cloud Function generates a short-lived, secure signed URL for Google Cloud Storage. This URL is scoped to a specific, unique path in the Storage bucket (e.g., `resumes/{orgId}/{applicationId}/{filename}`). The URL is returned to the frontend.
6.  **Direct Resume Upload**: The frontend application receives the signed URL and immediately uses it to upload the resume file directly to Google Cloud Storage. The data travels from the applicant's browser to Google Cloud Storage, and does *not* pass through the Cloud Function. This is a highly secure and efficient pattern for handling large file uploads.

### Stage 3: Post-Submission Triggers

- The creation of the new application document in Firestore triggers the `onApplicationCreate` function. This function performs background tasks such as updating the total number of applicants for the job and creating an entry in the `events` collection.

### Stage 4: Administrative Access (Protected)

7.  **Admin Views Applicants**: An authenticated administrator accesses the admin dashboard and views a list of applicants for a job. This action may call a Cloud Function (`getApplicants`) that reads from the `/orgs/{orgId}/applications` collection.
8.  **Admin Requests Resume**: To view a resume, the admin clicks a "Download Resume" button. This action calls a `getResume` Cloud Function, passing the `applicationId`.
9.  **Secure Resume Download**: The `getResume` function verifies the admin's permissions and then generates a short-lived signed URL for reading the specific resume file from Google Cloud Storage. This URL is returned to the admin's browser, which then downloads the file directly from Storage.

## 3. PII Security Considerations

- **No PII in Transit without Encryption**: All traffic is over HTTPS. Resumes are uploaded and downloaded directly to/from Google Cloud Storage using signed URLs, ensuring they are encrypted in transit.
- **PII at Rest is Secured**: Resumes are stored in a private Google Cloud Storage bucket with strict security rules that deny all public access. Firestore data is also encrypted at rest by Google Cloud.
- **Minimal PII Exposure**: Resumes are not passed through any intermediate services. They are directly uploaded and downloaded from a secure, private location. Access is only granted via short-lived, single-purpose signed URLs.
- **Data Isolation**: All applicant data, including resumes, is strictly isolated by `orgId` as defined in the **Multi-Tenant Service Boundary Map**.
