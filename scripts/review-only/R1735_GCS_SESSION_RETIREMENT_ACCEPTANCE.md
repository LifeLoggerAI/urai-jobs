# R1735 — GCS resumable-session retirement review contract

**Status:** non-networked review-only model. No real Google Cloud authentication, session cancellation, storage read/write, or evidence signing. R1732's proposed private-output hard denial remains unchanged and unmerged.

## Threat: upload session URI is a bearer secret
A resumable-upload session URI can authorize subsequent upload chunks without the original principal reauthenticating. Therefore revoking `storage.objects.create` for an old worker **alone cannot prove existing upload sessions stopped**. Never log, send to clients, or persist the session URI. Model code stores **only a SHA-256 digest** in its state and never prints the URI. A production custodian may need an encrypted restricted secret store for session retirement; no such system exists here.

## Required provider protocol
- Broker exclusively owns GCS create rights, issued session credentials, tenant-bound reservation, generation inventory and trustworthy audit.
- On revocation, atomically stop admissions and revoke epoch before **any** final deletion ACK.
- Independently terminate active GCS resumable sessions or prove they already completed. Timeout, worker death, IAM removal, or an HTTP response without trusted session identity is **not enough**.
- If completion raced cancellation, obtain the **actual generation**, delete with generation/metageneration preconditions, and independently re-read storage to verify absence.
- Deny stale old-epoch or alternate writers at provider level even if an old resumable URI leaks, and demonstrate that denial in an authorized isolated cloud canary. Do not equate a mock cancellation result with provider confirmation.
- Confirm no still-live sessions and all generation-bound object cleanup before trusted global-deletion ACK; retain sanitized evidence with independent review.

## Test scope
`gcs-resumable-session-retirement-review.mjs` is a pure synchronous state model with no HTTP, IAM, GCS API or persistent store. An injected `verify` callback marks evidence `authentic` in tests, **but this callback is synthetic/untrusted**. The model's claims do not close production gates. It requires strict owner/tenant/epoch/upload/session binding, handles ambiguous results fail-closed, records completed upload generation and requires matching generation in cleanup readback.

Run: `node --test scripts/review-only/gcs-resumable-session-retirement-review.test.mjs`

**Release HOLD / NO-GO. Private-memory writes OFF. No merge, provider access, deployment, new pod or permission change.**

