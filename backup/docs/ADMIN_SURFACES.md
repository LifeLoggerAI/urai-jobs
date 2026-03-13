# URAI Admin Surfaces & Power Classification

This document inventories all administrative capabilities, their power classification, and the strict UX rules that govern them.

## Power Classification

- **Class 1 (Read-only):** Viewing data, searching, filtering, inspecting logs.
- **Class 2 (Reversible):** Status changes, flagging, temporary suppression, internal notes.
- **Class 3 (Irreversible):** Deletion, bans, data export, system overrides.

## Admin Surfaces

### Application Management

- **View Applications (Class 1):** Admin can view a list of all applications.
- **View Application Detail (Class 1):** Admin can view the full details of a single application.
- **Change Application Status (Class 2):** Admin can change the status of an application (e.g., 'In Review', 'Closed'). *Requires confirmation.*
- **Add Internal Note (Class 2):** Admin can add timestamped notes to an application. *Notes are visible to all other admins.*

### Job Management

- **View Jobs (Class 1):** Admin can view a list of all jobs.
- **Create/Edit Job (Class 2):** Admin can create or edit job postings. *Changes are logged.*
- **Change Job Status (Class 2):** Admin can change a job's status (e.g., 'open', 'paused', 'closed'). *Requires confirmation.*

### User & Access Management

- **View Admins (Class 1):** Admin can see a list of all users with admin privileges.
- **Grant/Revoke Admin Access (Class 3):** Only an 'owner' role can grant or revoke admin access. *This action is heavily logged and requires multi-step confirmation.*

### System & Audit

- **View Audit Logs (Class 1):** Admin can view the immutable log of all actions taken within the admin system.

## Admin UX Rules

- **Calm & Boring:** The UI must be intentionally minimal, text-heavy, and devoid of any visual elements that create a sense of urgency or gamification.
- **Slow & Explicit:** All actions that modify data (Class 2 and 3) must require explicit confirmation. There are no one-click irreversible actions.
- **Logged & Accountable:** Every action is logged. Logs are immutable and easily accessible.
