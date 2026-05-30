# Public Runtime Visibility Note

This repository is currently public and documents internal job orchestration, worker contracts, queue lifecycle, callable functions, runtime states, and deployment sequence.

Before Genesis or production launch, confirm whether this repository should remain public.

If it remains public, keep it limited to launch-safe runtime code, documentation, examples, test contracts, and non-sensitive configuration only.

Do not commit:

- real secrets
- service-account files
- worker credentials
- production job payloads
- raw user data
- generated private artifacts
- internal incident evidence
- raw operational exports
- production logs with identifiers
- unreleased provider integration details

Runtime and operator routes must remain auth-gated. They should not be treated as public marketplace surfaces unless a separate product and security review approves that expansion.
