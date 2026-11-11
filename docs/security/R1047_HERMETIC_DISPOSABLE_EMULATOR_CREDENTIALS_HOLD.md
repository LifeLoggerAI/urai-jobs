# R1047 hermetic disposable emulator credential guard — REVIEW/HOLD

Parent: Jobs #426 exact `bffb07f18dce63c6eabb5d3309f14b31087a0ab6` (retains Jobs #424 and #425 parent ancestry; no donor branch changed).

A separate worker reported accidentally echoing an inherited RUNPOD_API_KEY into provider logs. That key remains potentially compromised until revoked/rotated. The previous R1046 non-echo regressions remain intact. This change broadens recognized provider credential names and unknown secret-like aliases; it requires exact `urai-staging-test` project and loopback Firestore/Storage emulators, rejects conflicting cloud project variables and untrusted Node preload/debug options, and never includes environment variable VALUES in errors.

`assertDisposableEmulatorEnvironment(process.env)` executes before Firebase Admin imports in the original disposable emulator fixture. The helper uses Node standard JavaScript only; it cannot grant private output writes, IAM roles or deletion acknowledgements. 7/7 isolated no-network Node 22 regression cases were run in a clean local container before committing (without original GitHub repository dependencies); these certify this helper's input behavior only. Separate exact commit full Jobs/frozen install/Firebase acceptance remains REQUIRED. The repository could not be cloned in this clean environment because outbound DNS for github.com was unavailable. No new Runpod pod was launched while the key-rotation incident is unresolved.

Original worker private-output hard-off unchanged, no production IAM/deploy/merge/owner media. Jobs #252 and ONE URAI Genesis production HOLD. User/account owner must revoke potentially exposed Runpod API key and review old provider logs. No key value is stored or reproduced here.
