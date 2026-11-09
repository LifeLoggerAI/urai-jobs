# ONE URAI GENESIS — R962 R647 donor test and source-execution readiness audit

**Date:** 2026-11-09 UTC  
**Disposition:** PRODUCTION HOLD / NO-GO  
**Scope:** exact GitHub readback of the R647 Privacy dispatcher donor, contract, tests, publisher and package scripts; source-level test characterization; one read-only Git network availability check. No application edits, cloud/provider calls, dispatcher invocation, endpoint request, IAM, merge, deployment, paid compute or media processing.

## 1. Executive result

R962 verified all six critical donor blobs against Privacy R647 #214 and inspected the original test execution design.

**Source identity: 6/6 exact donor pins fetched and matched to the previously recorded Git blob values.**

**Original donor test execution: NOT RUN.** A read-only attempt to reach the GitHub repository with `git ls-remote` failed because this environment could not resolve `github.com` (DNS lookup failure). No full checkout or locked node_modules installation is available from that failed attempt. Do not describe this as a test failure; it is an infrastructure/access blocker.

The source also establishes that the two donor test files are isolated Node/VM tests with mocked Firestore/transport behavior. They are not native Firebase Auth/Firestore/Functions/Storage emulator tests and do not exercise the real Jobs endpoint or a deployed dispatcher.

## 2. Immutable source pins reverified

Repository: `LifeLoggerAI/urai-privacy`  
Review: [PR #214 R647](https://github.com/LifeLoggerAI/urai-privacy/pull/214)  
Exact head: `cc0692053db3b1b8df8267d43856b1a3357de8a0`  
Branch: `review/r647-jobs272-source-lineage-hold-20261104`

| File | Git blob | Bytes | R962 result |
|---|---|---:|---|
| `functions/src/consent-revocation-jobs-dispatcher.ts` | `4126167b4350ba8afe6b19d7b60dec1ca891189f` | 13,281 | MATCH |
| `functions/src/consent-revocation-jobs-contract.ts` | `6cca2b9456319927cf22511c7d51c1f16ddf051c` | 10,586 | MATCH |
| `tests/consent-revocation-dispatcher-contract.test.mjs` | `def1048aa4838f7ff990d792a27d1fb94e7f6441` | 8,920 | MATCH |
| `tests/consent-revocation-jobs-contract.test.mjs` | `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa` | 14,086 | MATCH |
| `functions/src/consent-revocation.ts` | `5b069b79d657b5c2006dd0ab45c8e60709ff0a89` | 5,? | MATCH |
| `package.json` | `115d4ff9cbd646e6313e2de0590359a02f71e68f` | 7,276 | MATCH |

The file content and blob SHA were returned directly by GitHub for the exact immutable R647 ref. The table's donor publisher file byte count was not retained in this compact result; do not infer it.

Additional R647 source file:
- `functions/package.json`: blob `e7c9036117ce7b4f3a59c10f80617a6165afb288`; Functions package declares Node 22, TypeScript 5.9.3, Firebase Admin ^13.10.0, Firebase Functions ^6.6.0 and Zod ^3.23.8. Its own `test` script runs only `npm run typecheck`.

## 3. Original donor tests — what they actually cover

### A. Dispatcher state/lease test

File: `tests/consent-revocation-dispatcher-contract.test.mjs`  
Blob: `def1048aa4838f7ff990d792a27d1fb94e7f6441`  
Counted top-level Node `test()` declarations: **10**.

The test:
- reads the original TypeScript dispatcher file;
- transpiles it with the installed TypeScript package using `ts.transpileModule`;
- evaluates it in a Node VM context;
- injects fake `FieldValue`, fake `Timestamp`, fake Firestore transaction/query objects and fake lease UUID;
- replaces contract building and network sending with test doubles.

Covered cases include:
1. Only verified ACK permits root outbox applied state.
2. Timeout is retried with durable attempt and no raw provider error.
3. Corrupt source/exhausted retries enter needs-review.
4. Stolen lease cannot be finalized by the old worker.
5. Forged ACK identity is not accepted.
6. Invalid token/endpoint creates no lease or transmission.
7. Lease time is sampled at claim, not stale scan time.
8. Retry deadline starts after network completion.
9. Clock regression before claim fails closed.
10. Clock regression after remote response cannot create false applied receipt.

**Boundary:** This validates dispatcher control-flow against its fake Firestore and fake contract/transport; it does not execute actual Firebase transaction semantics or make an HTTPS request.

### B. Jobs contract/transport test

File: `tests/consent-revocation-jobs-contract.test.mjs`  
Blob: `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa`  
Counted top-level Node `test()` declarations: **16**, plus generated parameterized tests.

The test:
- reads and transpiles the real TypeScript contract module;
- VM-loads the compiled exports;
- builds synthetic publisher v1 event records and fake Jobs acknowledgement responses;
- injects mocked transport requests rather than calling the endpoint.

Coverage includes:
- valid v1-to-v2 field mapping and deterministic timestamp behavior;
- ACK identity/hash and cleanup summary verification;
- source record ID, event digest, integrity, ownership and timestamp negatives;
- schema/status/receipt/tier negatives;
- wrong consumer, owner, event, status, count, missing/forged ACK;
- strict pinned HTTPS destination, bearer format and no redirects;
- malformed, oversized, invalid UTF-8 and streamed response boundaries;
- stable ACK hash across idempotent cleanup retries;
- foreign host/destination rejection.

**Boundary:** These are deterministic parser/contract/transport tests. HTTP is mocked; no real Jobs endpoint, Firebase Auth, Firestore, Cloud Run or deployed IAM is exercised.

## 4. Exact commands in R647 package scripts

From the Privacy repository root:

```bash
npm run test:revocation:jobs:contract
npm run test:revocation:dispatcher
```

The package maps them to:

```bash
node --test tests/consent-revocation-jobs-contract.test.mjs
node --test tests/consent-revocation-dispatcher-contract.test.mjs
```

The broader root `preflight` includes these two commands alongside many other Privacy checks. Do not use the entire production preflight as a substitute for first running and capturing the two focused donor tests.

From the Functions package:
```bash
npm run typecheck
```

This alone does not run either donor Node test.

## 5. R962 execution attempt and actual blocker

A read-only container command was attempted:

```bash
git ls-remote https://github.com/LifeLoggerAI/urai-privacy.git refs/heads/review/r647-jobs272-source-lineage-hold-20261104
```

Observed result:
- `fatal: unable to access 'https://github.com/LifeLoggerAI/urai-privacy.git/'`
- `Could not resolve host: github.com`
- exit code 128.

Therefore:
- no clone was created;
- no files were reconstructed locally;
- no `npm ci` or dependency install was attempted;
- no test command was executed;
- no emulator or provider process was started.

This is a Git network/DNS environment blocker, not evidence that R647 source or its tests fail.

## 6. Current R20 comparison remains unchanged

Privacy R20 #256:
- head `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6`;
- publisher blob `84f1e77d5c1cf55f80aaa0a559b6a3eac781386e`;
- transition helper blob `0ddee615f1284a58459aae48b915a574da7c9c9e`.

R20 cannot be used with R647 unchanged:
1. R20 publisher does not set the delivery queue fields the dispatcher query requires.
2. R20 integrityHash includes prior-grant evidence; R647 validates the old hash shape.
3. R647 Jobs v2 projection omits priorGrantReceiptHash and priorGrantEvidenceState.
4. R647 derives revokedAt from outbox createdAt; R20 has no distinct immutable source transition timestamp in the event.

The R20 publisher's eventId digest itself is computed from schemaVersion, recordId, uid, purpose, consentTier, policyVersion and source receipt hash; the separate R20 integrityHash adds prior grant evidence. The replay classifier compares prior-grant lineage on retries. Any new contract must explicitly define whether event identity should also bind that prior evidence, and how immutable collision/legacy behavior is handled. Do not change this without contract review.

## 7. Next execution plan

### Immediate, when a real full checkout/network is available
1. Create a clean detached checkout at exact R647 head `cc0692053db3b1b8df8267d43856b1a3357de8a0`.
2. Verify exact Git commit, tree and all six donor source blobs before running tests.
3. Record Node version and package lock identity. Use the repository's locked install command; do not change dependency ranges or lockfile.
4. Execute both exact focused commands separately and capture TAP, exit code and SHA256.
5. Run Functions typecheck separately.
6. Inspect every failing assertion and preserve source/fixture mismatch; do not patch donor in place to make it pass.
7. Re-run only after documented review-only fixes in a new immutable branch; retain original donor branch unchanged.

### Then canonical contract design
8. Draft new explicit event version for R20 lineage and timestamp provenance.
9. Bind owner, purpose, tier, policy, current receipt, prior grant hash/state, source transition time/provenance, outbox creation time, correlation and full integrity evidence.
10. Decide whether eventId digest binds prior-grant lineage; define expected behavior when prior grant missing/invalid or legacy.
11. Reconcile dispatcher root ACK versus Privacy per-consumer ACK and Jobs local receipt.
12. Only after design review, prepare separate Privacy and Jobs review-only patches.

### Integrated acceptance after source convergence
13. Same-SHA native Firebase Auth/Firestore/Functions/Storage emulator test: publisher → outbox → dispatcher → Jobs receiver → canonical ACK.
14. Negative tests: timeout after Jobs commit, duplicate delivery, stale lease, corrupt payload, regrant during transit, changed owner/purpose, invalid/missing prior grant, wrong consumer, forged ACK and partial cleanup.
15. Separately verify actual nonproduction Storage write denial, upload draining and exact-generation purge ACK.

## 8. R962 evidence classification

**S (source):** six exact donor blobs fetched from the immutable R647 GitHub head; original tests and scripts inspected.

**F/U (access blocker):** Git clone access failed because DNS could not resolve github.com in the execution environment.

**NOT RUN:** 26 combined top-level donor test cases, Functions typecheck, root preflight, emulator tests and any cloud/provider operation.

**Prohibited:** no cherry-pick, merge, deployment, dispatcher invocation, private media processing, IAM changes or paid compute.

**R962 final:** donor source is reproducibly identified and the test suites are understood; native execution remains pending a host with GitHub connectivity and a clean locked checkout. Production remains HOLD / NO-GO.
