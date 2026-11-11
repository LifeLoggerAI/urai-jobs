# ONE URAI R1046 — two-parent conservative pre-byte lifecycle convergence (HOLD)

## Donor custody
- Parent 1: Jobs #425 current R1045 review-only job/owner/consent source `acef589f48018511965cba77531e70964e6dc9ac`.
- Parent 2: Jobs #424 R1044 three-stage canonical owner revocation source `e3fb4ef5caca9bad7eeb14a77efa1692dd79e38f`, independently 17/17 Firebase emulator + complete native PASS on its own exact commit.
- Earlier: #423 R1042 canonical owner veto (16/16 emulator + full native PASS), #422 R1040 dry-run GCS denial probe (10/10 mocked + full native PASS), historical #420, #419 two-parent revocation schema, #415/#416 donors. Preserve unique peer histories and branches; no bulk closure.

## Unique changes in this two-parent commit
- Keep #425 full simulator source with canonical withdrawal, live consent block, owner disabled/deletion pending, job identity/status/purpose checks at reserved / begin / pre-byte boundaries. ALL are emulator/review-only, never cloud write authority.
- Preserve the distinct #424 R1044 pre-byte residual-state regression: after canonical withdrawal, per-project review scope remains OPEN, one in-flight attempt stays unresolved, no deletion ACK.
- Add separately isolated post-reservation job owner / tenant / consent-purpose mutation tests spanning begin and pre-byte. Preserve independent-owner isolation and no authorization.
- Add synthetic-token non-disclosure regression for inherited RUNPOD_API_KEY, GITHUB_TOKEN, GOOGLE_APPLICATION_CREDENTIALS and FIREBASE_TOKEN; assert credential guard runs before Firebase imports. No real token values present in code/tests.

## Security incident
A parallel worker reported that an inherited Runpod API key was accidentally echoed in disposable runner provider logs. The affected old Pods were stopped, the fixture error was patched to be non-echoing in #425, and this new test makes non-disclosure a regression requirement. Do NOT copy, paste, scrape, commit or reproduce those provider log values. Treat key as potentially compromised until revoked/rotated by owner in Runpod Settings > API Keys; review provider log access and billed usage. This commit does not revoke any account credential.

## Required verification before acceptance
Fresh detached exact-commit readback, frozen installation, static redaction tests, typecheck, full Jobs native verify and disposable Firebase Auth/Firestore/Storage emulator acceptance under an explicitly credential-scrubbed process. The parent PR PASS results are not proof of R1046.

## Release HOLD
Original `privateOutputWriteAuthorityAvailable()` remains hard-false. Jobs #252: no exclusive least-privilege GCS IAM broker, actual old/alternate writer negative data-plane proof, durable before-first-byte upload admission, in-flight stream drain, generation-specific exact cleanup and post-revocation no-rewrite verification, authenticated positive consent→Studio→Jobs→protected Replay→delete, protected CI/reviewer and device/AAA signoff. No private writes enabled, no IAM, no production deploy, no release approval.
