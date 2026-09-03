# URAI-JOBS Freeze-and-Repair Plan

## PHASE 0 — LOCK SCOPE

- **In Scope for Repair:**
    - Install/run/build correctness
    - Routing correctness
    - Firebase init correctness
    - Auth correctness
    - Profile/job/application correctness
    - Dashboard correctness
    - AI truth labeling
    - Validation/security hardening
    - Tests for critical flows
    - Doc correction

- **Explicitly Out of Scope:**
    - New recommendation algorithms beyond minimal truthful implementation
    - Advanced resume intelligence
    - Embeddings/vector search unless already substantially present
    - Major UI redesign
    - Product expansion

- **"Done" for this Repair Pass Means:**
    - The `npm install` and `npm run build` commands succeed.
    - The application runs locally without errors.
    - The core user flows (authentication, job creation, job application) are functional and secure.
    - All AI features are either disabled, clearly marked as placeholders, or have a minimal, truthful implementation.
    - The Firestore rules and callable functions have been hardened to prevent basic security vulnerabilities.
    - The codebase is free of dead or duplicate code.
    - All documentation accurately reflects the state of the project.
