# URAI Audit Log Policy

All administrative actions are logged. This log is the canonical record of change and the foundation of accountability.

## Log Structure

Each audit log entry must contain:

- `timestamp`: The exact time of the action (server timestamp).
- `adminId`: The UID of the administrator who performed the action.
- `actionType`: The type of action performed (e.g., `application.status.change`, `job.create`).
- `entityId`: The ID of the document or entity that was affected.
- `changes`: A map containing the state before and after the action (for Class 2 and 3 actions).
- `reason`: An optional, but encouraged, free-text field for the administrator to explain *why* the action was taken.

## Rules of the Log

1.  **Immutability:** Audit logs are append-only. They can never be edited or deleted by any user, including an owner.
2.  **Completeness:** Every action that changes state or data must generate an audit log entry.
3.  **Accessibility:** Logs must be easily reviewable by administrators to ensure transparency and accountability.
4.  **Retention:** Audit logs are retained indefinitely.
