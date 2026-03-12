# URAI-Jobs: Disaster Recovery Runbook

This document provides a runbook for recovering the URAI-Jobs platform in the event of a catastrophic failure or data loss. The platform's reliance on managed, serverless Google Cloud services simplifies disaster recovery significantly.

## 1. Core Principles

- **Leverage Managed Services**: The primary DR strategy is to rely on the inherent durability and redundancy of Google Cloud's services (Firestore, Cloud Storage, Firebase Hosting, Cloud Functions).
- **Infrastructure as Code**: The entire platform configuration is defined in code (`firebase.json`, `firestore.rules`, `storage.rules`), allowing for rapid, reproducible deployments.
- **Stateless Application Logic**: Cloud Functions are stateless, meaning they can be redeployed without data loss.

## 2. Disaster Scenarios and Recovery Procedures

### Scenario 1: Accidental Deletion of Production Firebase Project

**Impact**: Total loss of service, data, and configuration.

**Recovery Steps**:

1.  **Create a New Firebase Project**: A project owner creates a new Firebase project in the Google Cloud console.
2.  **Restore Data from Backups**:
    - **Firestore**: Google Cloud provides a Point-in-Time Recovery (PITR) feature for Firestore, which allows for restoring the database to its state at any point in the last 7 days. An administrator with appropriate permissions will initiate a restore from the most recent point before the deletion.
    - **Cloud Storage**: The resume bucket should have Object Versioning enabled. This allows for the restoration of deleted objects.
3.  **Redeploy the Platform**:
    - Check out the latest version of the `main` branch from the Git repository.
    - Link the local project to the new Firebase project (`firebase use --add`).
    - Run the production deployment command (`firebase deploy`). This will redeploy all Cloud Functions, Hosting content, and security rules from the configuration files in the repository.
4.  **Verify Restoration**: Manually verify that the data has been restored and the platform is functional.

### Scenario 2: Catastrophic Data Corruption in Firestore

**Impact**: The application is online, but data is incorrect or unusable.

**Recovery Steps**:

1.  **Activate Read-Only Mode**: If possible, deploy a version of the Firestore security rules that denies all write operations to prevent further corruption.
2.  **Identify Last Known Good State**: Use logs and monitoring to determine the timestamp immediately before the corruption occurred.
3.  **Perform Point-in-Time Recovery (PITR)**: Initiate a PITR of the Firestore database to the identified timestamp.
4.  **Validate Data**: After the restore is complete, run validation scripts to ensure the data is correct.
5.  **Restore Normal Write Access**: Redeploy the standard Firestore security rules to re-enable write operations.

### Scenario 3: Loss of the Code Repository

**Impact**: Inability to deploy updates or redeploy the platform. The running services are unaffected in the short term.

**Recovery Steps**:

1.  **This is a critical failure of development operations, not a production outage.**
2.  **Restore from Backups**: The Git repository should be hosted on a service (e.g., GitHub, GitLab) that provides its own backups. Restore the repository from the service's backups.
3.  **Failing that, a developer with a recent, complete copy of the `main` branch on their local machine will need to re-create the central repository.**

## 3. Preventative Measures

- **Enable Firestore PITR**: This is the most critical DR feature and must be enabled on the production database.
- **Enable Cloud Storage Object Versioning**: This protects against accidental deletion of resumes.
- **Enforce Branch Protection Rules**: The `main` branch of the Git repository should be protected, requiring pull requests and reviews before merging.
- **Regularly Back Up the Git Repository**: Although hosted git services are reliable, an independent backup strategy is recommended for critical infrastructure.
