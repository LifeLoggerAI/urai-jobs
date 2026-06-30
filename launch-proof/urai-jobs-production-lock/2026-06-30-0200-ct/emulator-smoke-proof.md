# Emulator Smoke Proof

Starting SHA: 9ad2137c2689e6aa936e72b0552a0a1913981714
Branch: production-lock-jobs-2026-06-30

Status: BLOCKED in this pass because local repository checkout failed in the execution environment.

Required emulator proof before READY:

1. Start Firestore/Auth/Functions/PubSub emulators.
2. Seed authorized user and claims.
3. Create a permitted job through callable.
4. Verify job and queue docs.
5. Lease/process with local worker or explicit local inline fallback.
6. Verify success path, fail path, retry path, cancel path, status query, logs query, and unauthorized denial.

Inline fallback is acceptable only for local/emulator proof and must be explicitly enabled with `URAI_JOBS_ALLOW_INLINE_FALLBACK=true`.
