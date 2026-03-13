# URAI-Jobs: Enterprise-Grade Audit Log Architecture

## 1. Objective

To create a comprehensive and immutable record of all significant events within the `urai-jobs` system. This audit trail is critical for security analysis, compliance reporting, system debugging, and maintaining accountability for all user and system actions.

## 2. Architecture

*   **Storage:** A dedicated, append-only Firestore collection named `auditEvents`.
*   **Security Rules:** This collection will have strict security rules preventing any client-side modification or deletion. Only a trusted server-side process (e.g., a specific Cloud Function with elevated privileges) can write to this collection.
*   **Immutability:** Once written, an audit log entry cannot be altered.

## 3. Log Schema

Each document in the `auditEvents` collection will adhere to a standardized JSON schema to ensure consistency and facilitate automated analysis.

```json
{
  "eventId": "[string] A unique ID for the event (e.g., nanoid)",
  "timestamp": "[timestamp] The exact server timestamp when the event occurred",
  "eventType": "[string] A namespaced, dot-separated identifier for the type of event",
  "actor": {
    "type": "[string] 'user' or 'system'",
    "id": "[string] The UID of the user or a name for the system process (e.g., 'daily-digest-job')",
    "ipAddress": "[string, optional] The IP address of the acting user"
  },
  "target": {
    "type": "[string] The type of entity being acted upon (e.g., 'application', 'job', 'user')",
    "id": "[string] The ID of the target entity"
  },
  "details": {
    "[any]": "A map containing event-specific context. For updates, this should include 'previousState' and 'newState'."
  },
  "context": {
    "userAgent": "[string, optional] The User-Agent string from the client",
    "sessionId": "[string, optional] The session ID, for tracing user activity"
  }
}
```

## 4. Key Event Types to Log (`eventType`)

### Authentication Events
*   `auth.login.success`
*   `auth.login.failure`
*   `auth.logout`
*   `auth.password.reset_request`

### Administrative Actions
*   `admin.job.created`
*   `admin.job.updated`
*   `admin.job.status.changed`
*   `admin.user.role.changed`

### Application Lifecycle Events
*   `application.submitted`
*   `application.status.changed` (e.g., from 'NEW' to 'SCREEN')

### AI & System Events
*   `ai.insight.generated`
*   `ai.feedback.logged` (when an admin's action confirms or contradicts an AI suggestion)
*   `ai.model.weights.updated`
*   `system.digest.generated`

### Security & Data Events
*   `security.permission.denied` (when a Firestore rule denies an action)
*   `data.export.run` (e.g., CSV export)
*   `data.record.deleted` (in response to a user deletion request)

## 5. Retention Policy

Audit logs are critical for long-term analysis and compliance. They will be retained for a minimum of **18 months**.
