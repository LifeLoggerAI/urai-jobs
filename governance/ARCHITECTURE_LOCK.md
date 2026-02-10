# ARCHITECTURE_LOCK.md

**Version:** 1.0.0
**Date:** 2023-10-27

This document freezes the architecture for the URAI-Jobs system, version 1.0.0. No changes to the fundamental structure, folder layout, or data flow boundaries described herein are permitted without a formal governance review.

## 1. Core Principle: Segregation of Concerns

The system is divided into distinct, non-overlapping components. Code, data, and documentation must not cross these boundaries.

- **`web/`** must not contain backend logic.
- **`functions/`** must not directly serve frontend assets.
- **`governance/`** must not contain executable code.
- **`docs/`** must not contain internal system secrets or implementation details.

## 2. Final Folder Structure

The canonical folder structure for URAI-Jobs v1.0.0 is:

```
urai-jobs/
|-- functions/          # Backend Cloud Functions (TypeScript)
|-- firestore/          # Firestore rules and indexes
|   |-- firestore.indexes.json
|   `-- firestore.rules
|-- governance/         # Governance locks, policies, and attestations
|   |-- ARCHITECTURE_LOCK.md
|   `-- GOVERNANCE_LOCK.md
|-- public/             # Compiled frontend output (from /web)
|-- web/                # Frontend SPA source (React + TypeScript)
|-- .firebaserc         # Firebase project configuration
|-- firebase.json       # Firebase deployment configuration
|-- pnpm-workspace.yaml # PNPM workspace definition
```

## 3. Data Flow

- **Frontend (`web/`) -> Backend (`functions/`)**: All communication from the frontend to the backend MUST occur via authenticated and validated HTTPS Callable Functions.
- **Backend (`functions/`) -> Firestore**: Functions interact with Firestore using the Firebase Admin SDK, subject to the service account's permissions.
- **Firestore -> Frontend (`web/`)**: Direct client-side access to Firestore is limited to read-only operations on public data collections (`jobPublic`) as defined in `firestore.rules`.
- **External Systems**: No external integrations are permitted, except for the core Firebase services (Auth, Firestore, Functions, Storage).

This architecture is now locked.
