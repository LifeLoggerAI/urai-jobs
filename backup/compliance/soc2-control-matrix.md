# URAI-JOBS SOC 2 Control Matrix

| Control ID | Trust Principle | Control Description | Implementation | Evidence Location | Status |
|------------|-----------------|--------------------|----------------|------------------|--------|
| CC1.1 | Control Environment | Defined security governance structure | Governance policies committed in repo | /docs/governance | Implemented |
| CC2.1 | Communication | Incident Response Plan documented | INCIDENT_RESPONSE_PLAN.md | /docs/security | Implemented |
| CC3.1 | Risk Assessment | Annual risk review required | Risk Register maintained quarterly | /docs/compliance | Pending |
| CC5.1 | Logical Access | Role-based access enforced | Firebase custom claims + Firestore rules | firestore.rules | Implemented |
| CC6.1 | Authorization | Org-scoped tenant isolation | /orgs/{orgId}/ structure | Firestore schema | Implemented |
| CC6.2 | Privileged Access | Admin access limited + MFA | Firebase Auth + IAM | IAM settings | Implemented |
| CC6.3 | Access Revocation | Quarterly access review | ACCESS_CONTROL_POLICY.md | /docs/governance | Pending Review |
| CC7.1 | Change Management | Signed release manifests | RELEASE_MANIFEST.json + GPG | /releases | Implemented |
| CC7.2 | Monitoring | Logging and anomaly detection | Cloud Logging + alerts | GCP console | Partial |
| CC8.1 | Data Protection | Encryption at rest + TLS | GCP default encryption | GCP config | Implemented |
| CC8.2 | Data Retention | Retention policy documented | DATA_RETENTION_POLICY.md | /docs/security | Implemented |
| CC9.1 | Incident Response | Formal containment procedures | INCIDENT_RESPONSE_PLAN.md | /docs/security | Implemented |
| A1.1 | Availability | Backup and recovery defined | Backup policy documented | GCP backup config | Partial |
| C1.1 | Confidentiality | Org data partitioning | Firestore rules | firestore.rules | Implemented |
| P1.1 | Privacy | Deletion workflow defined | Data deletion function | Cloud Functions | Partial |