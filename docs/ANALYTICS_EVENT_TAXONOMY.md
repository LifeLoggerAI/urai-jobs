# URAI Jobs Analytics Event Taxonomy

URAI Jobs frontend analytics events use the `jobs_` prefix. Events should avoid secrets, raw payloads, resumes, tokens, personally sensitive content, or full error stack traces.

## Event naming rules

- Prefix all events with `jobs_`.
- Use lowercase snake case.
- Include stable IDs only when needed for debugging and never include secrets.
- Prefer metadata categories over raw payloads.

## Core events

| Event | Trigger | Suggested properties |
| --- | --- | --- |
| `jobs_page_viewed` | A route/page is rendered | `path`, `surface` |
| `jobs_login_viewed` | Login page rendered | `surface` |
| `jobs_login_succeeded` | User signs in | `uid_present`, `role`, `urai_jobs_admin` |
| `jobs_login_failed` | Login fails | `reason` |
| `jobs_create_viewed` | Create job page rendered | `surface` |
| `jobs_create_submitted` | Create job form submitted | `job_type` |
| `jobs_create_succeeded` | Job is created | `job_type`, `job_id_present` |
| `jobs_create_failed` | Job creation fails | `job_type`, `reason` |
| `jobs_admin_viewed` | Admin page rendered | `surface` |
| `jobs_admin_refreshed` | Admin list refreshed | `status`, `count` |
| `jobs_job_selected` | Operator opens a job detail | `status`, `job_type` |
| `jobs_job_retry_clicked` | Retry button clicked | `status`, `job_type` |
| `jobs_job_retry_succeeded` | Retry callable succeeds | `job_type` |
| `jobs_job_retry_failed` | Retry callable fails | `reason` |
| `jobs_job_cancel_clicked` | Cancel button clicked | `status`, `job_type` |
| `jobs_job_cancel_succeeded` | Cancel callable succeeds | `job_type` |
| `jobs_job_cancel_failed` | Cancel callable fails | `reason` |
| `jobs_legal_viewed` | Legal page rendered | `page` |
| `jobs_trust_viewed` | Trust page rendered | `page` |

## Implementation

Use:

```ts
import { trackJobsEvent } from "../lib/analytics";

trackJobsEvent("page_viewed", { path: window.location.pathname, surface: "web" });
```

The helper automatically prefixes events with `jobs_`, dispatches a browser event, pushes to `window.dataLayer` when present, and keeps a small local debug buffer.

## Debugging

In browser DevTools:

```js
window.uraiJobsAnalytics.flushBuffer()
```

This returns buffered analytics events from the current browser.

## Privacy constraints

Never include:

- Firebase ID tokens
- passwords
- resume text
- raw job payloads that may contain personal data
- full stack traces
- private service URLs or secrets
- candidate notes or employer notes

Allowed:

- boolean flags
- coarse status
- job type
- route path
- count values
- whether a job ID exists, not necessarily the full ID unless debugging requires it
