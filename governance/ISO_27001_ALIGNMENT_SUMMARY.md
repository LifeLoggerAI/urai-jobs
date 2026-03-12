# URAI-Jobs: ISO 27001 Alignment Summary

This document provides a high-level summary of how the URAI-Jobs platform's security controls align with the annexes of the ISO/IEC 27001 standard. This demonstrates a commitment to a formal Information Security Management System (ISMS).

## Annex A.5: Information Security Policies

- **A.5.1 Management direction for information security**: The **MASTER EXECUTION PROTOCOL** and the generated governance artifacts (Architecture Blueprint, Data Flow Diagram, Threat Model) serve as the documented security policy for the URAI-Jobs platform.

## Annex A.8: Asset Management

- **A.8.1.1 Identification of assets**: The **Production Architecture Blueprint** identifies all primary information assets, including the frontend application, Cloud Functions, Firestore database (containing applicant and job data), and Cloud Storage (containing PII resumes).
- **A.8.1.3 Rules for the acceptable use of information**: The **Multi-Tenant Service Boundary Map** and Firestore/Storage security rules define the acceptable use policies for accessing and manipulating data.

## Annex A.9: Access Control

- **A.9.1.1 Access control policy**: Access is governed by a default-deny policy. The core principle is multi-tenant isolation based on a user's `orgId` claim.
- **A.9.2.3 Management of privileged access rights**: Privileged access (platform administrator) is strictly controlled and managed via the `/admins/{uid}` collection in Firestore, which is protected by restrictive security rules.
- **A.9.4.1 Limitation of access to information**: Firestore and Storage Security Rules enforce the principle of least privilege. Users can only access the data and functions necessary for their role (e.g., an applicant cannot access any data but their own submission).

## Annex A.10: Cryptography

- **A.10.1.1 Policy on the use of cryptographic controls**: All data is encrypted in transit using HTTPS/TLS, enforced by Firebase Hosting and Cloud Functions. All data is encrypted at rest by default in Google Cloud Firestore and Storage.

## Annex A.12: Operations Security

- **A.12.1.2 Protection against malware**: The use of managed, serverless Google Cloud services (Firebase) provides a high degree of protection against malware on the underlying infrastructure.
- **A.12.1.4 Separation of development, testing and operational environments**: The Firebase Local Emulator Suite provides a complete, isolated environment for local development and testing, separate from the production environment.
- **A.12.4.1 Event logging**: Key events, such as application submission and status changes, are logged to the `events` collection in Firestore, providing a basic audit trail.

## Annex A.13: Communications Security

- **A.13.1.1 Network controls**: The Google Cloud network infrastructure provides robust network controls. Security rules on backend services act as a firewall, restricting access to authorized users and services.
- **A.13.2.1 Information transfer policies**: The **Applicant Data Flow Diagram** documents the secure policy for transferring sensitive PII (resumes) using short-lived signed URLs, preventing the data from passing through intermediary services.

## Annex A.14: System Acquisition, Development and Maintenance

- **A.14.1.1 Information security requirements analysis and specification**: The **MASTER EXECUTION PROTOCOL** itself serves as the formal requirements analysis and specification for the security of the URAI-Jobs platform.
- **A.14.2.1 Secure development policy**: The protocol mandates a secure development lifecycle, including threat modeling (STRIDE), static analysis (ESLint), and deterministic builds.
- **A.14.2.5 Secure system engineering principles**: The multi-tenant architecture with its strict data partitioning (`orgId`) is a core example of secure system engineering, making isolation the default behavior rather than an afterthought.

## Annex A.18: Compliance

- **A.18.1.3 Protection of records**: All data is stored in Google Cloud Firestore and Storage, which are durable and managed services. Resumes (PII) are stored in a non-public, access-controlled bucket.
- **A.18.1.4 Privacy and protection of personally identifiable information (PII)**: The entire system is designed around the secure handling of PII, as documented in the **Data Flow Diagram** and enforced through cryptographic controls and strict access policies.
