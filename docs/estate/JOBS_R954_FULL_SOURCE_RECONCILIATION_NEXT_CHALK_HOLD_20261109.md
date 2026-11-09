# ONE URAI GENESIS — Jobs R954 Full Source Reconciliation and Next-Chalk Handoff

**Checkpoint:** R954 · November 9, 2026  
**Release status:** **PRODUCTION HOLD / NO-GO**  
**Purpose:** Continue from the permanent R944–R953 forensic record without repeating historical discovery or mistaking source-level evidence for production acceptance.

## 1. Executive disposition

R954 strengthens the evidence for the R951 production-first worker authentication correction. The key advancement reported for this round is that the five complete original worker source files used by the authentication review were independently checked against their Git blob identities, rather than relying on abbreviated source excerpts. The reported authentication regression groups pass 4/4 in an adapted JavaScript harness, and a deliberate unsafe-condition mutation is detected.

This remains source-derived verification. It does **not** prove that a deployed container uses these files, that Cloud Run ingress/IAM is safe, that live bearer-token middleware rejects unauthorized HTTP requests, or that Firebase/GCS runtime behavior is certified.

The live GitHub readback performed for this handoff confirms:

- Jobs PR [#389](https://github.com/LifeLoggerAI/urai-jobs/pull/389) is **open, draft, and unmerged**.
- #389 targets the review branch `review/chalk-r951-worker-emulator-auth-boundary-20261109`, not `main`.
- #389 head SHA: `b865209cc352241602d8b9714672f3401aed7669`.
- #389 has 3 changed files; it enrolls the original R951 authentication regression in the root verification and guarded R879 runner.
- Its description records **78 unique root command segments enrolled, not executed**; original R951 test blob pinned as `d27cc3880aa2ae0387f81bb660ca340d830e22dc`; and an R879 required `# pass 4` stage.
- The #389 description records **58/58 source pins matching** its exact source tree. This is a source-integrity result, not a test-suite pass.
- The R952 48/48 result is an isolated source-extracted expression matrix, not the full original standalone test or native emulator acceptance.
- #379 remains the open draft forensic documentation PR. Genesis cross-chat PR [Labs #304](https://github.com/LifeLoggerAI/urai-labs-llc/pull/304) remains open, draft, and unmerged.

No merge, deployment, production resource mutation, paid compute, customer jobs, or private-media access is authorized by this handoff.

## 2. R954 new evidence — preserve its exact grade

### 2.1 Complete-source integrity

Reported R954 result: **5/5 complete original worker source files verified** by independently recomputing Git SHA-1 blob identities against the reviewed Git tree.

Interpretation:
- This improves on the R953 abbreviated-source-excerpt execution.
- It supports that the worker source used for the isolated test was byte-identical to the selected Git objects.
- It does not certify the deployed image, deployed revision, live service identity, HTTP path, or provider permissions.

The filenames and individual Git blob hashes are not included in the user-supplied R954 checkpoint text. The next worker must retrieve them from the R954 receipt/PR tree before making a stronger per-file claim. Do not invent or infer missing hashes.

### 2.2 Authentication assertions

Reported R954 result: **4/4 authentication regression groups PASS** using complete worker file contents in an adapted JavaScript harness.

Evidence grade: complete-source, adapted isolated harness.

Not equivalent to:
- Running the original standalone Node test in a clean full repository checkout;
- Sending HTTP requests to each real worker middleware/route;
- Executing the full 78-command root verification;
- Running the four disposable Firebase emulators;
- Verifying Cloud Run deployed image provenance or live IAM.

### 2.3 Adversarial mutation

Reported R954 result: the unsafe condition was deliberately restored and detected; **3 pass / 1 expected failure**. The corrected condition was restored and the regression groups returned to **4/4 PASS**.

This is useful evidence that the tested assertion detects the known insecure condition. Keep the expected failure classified as an intentional mutation-test failure, not a successful production test. Retrieve the actual TAP/log and SHA-256 receipts before citing exact digests; none are asserted in this checkpoint.

## 3. Source and PR lineage

The following review chain is the relevant authentication lineage:

| PR | Role | State at handoff |
|---|---|---|
| [#387](https://github.com/LifeLoggerAI/urai-jobs/pull/387) | Narrator canonical entrypoint and execution-route authentication assertions | Open review lineage; not production certification |
| [#388](https://github.com/LifeLoggerAI/urai-jobs/pull/388) | Production/staging-first bearer authentication; emulator flag cannot excuse missing token in production/staging | Open draft, unmerged |
| [#389](https://github.com/LifeLoggerAI/urai-jobs/pull/389) | Enroll the R951 standalone auth regression in root verification and guarded R879 runner | Open draft, unmerged |

PR #388's source correction addresses four worker bearer guards: an emulator flag must not turn missing credentials into an allowed production/staging request. Local/emulator testing remains possible only outside production/staging. R951's 48-case matrix exercised four extracted predicates across six environment settings and two emulator-flag settings.

PR #389 is an acceptance-enrollment change. It does not itself establish that the worker correction is deployed or that the 78 commands have run. It is based on #388's review branch and must not be described as a main-branch fix.

Earlier worker findings remain relevant:

- **Narrator:** older legacy `workers/narrator-worker/index.js` source has an unprotected endpoint; canonical Dockerfile selects `src/index.ts`, whose `/execute-job` route uses bearer-token authentication. R950 strengthened the checker to require the secured entrypoint and protected execution route. Actual deployed image and ingress remain unknown.
- **Asset:** bearer-protected execution; callback credential boundary requires separate verification.
- **Studio:** authenticated request path but private media rendering remains intentionally hard-off.
- **Private Source:** protected production route; local/emulator bypass must remain subordinate to production/staging authentication.
- **Captured Reality:** protected dispatch; callback token and consent checks require runtime verification.
- **Legacy Spatial worker:** explicitly refuses unimplemented execution.

## 4. R949 deployment, rollback, and Studio boundaries

R949 established that several deployment safeguards are source-level blocks, not proof of deployed state.

- Canonical production deployment workflow contains approval/source/identity/secret-version checks.
- Legacy Firebase deployment is explicitly blocked.
- Generic IAM bootstrap is blocked from creating new broad grants; this does not prove historic grants have been revoked.
- Generic managed-worker deployment is explicitly blocked.
- The manual `rollback-on-smoke-failure` workflow was a false-success placeholder. Review PR [#386](https://github.com/LifeLoggerAI/urai-jobs/pull/386) changes it to fail explicitly. Original rollback tests were reported **3/3 PASS** at exact source. This tests the hard-stop behavior, not a real restore.
- A separate Cloud Run rollback script includes a traffic-update operation, but has not been executed or operationally certified. Do not claim rollback readiness until an authorized disposable/staging rehearsal proves exact previous-revision restoration, health verification, and failure behavior.
- Studio's `lifeMovieConsentAuthorityAvailable()` returns false and causes render requests to fail closed (HTTP 503). `privateOutputWriteAuthorityAvailable()` returns false before private GCS MP4/SRT writes. Original focused guard checks were reported **3/3 PASS**. These are deliberate safety interlocks, not a functioning private-media service.
- Source configuration includes public HTTP invocation for some Cloud Run workers with application-level bearer authentication. The effective live ingress policy and deployed middleware remain unverified.

**Do not turn these hard-offs on** merely to make readiness or a demo green. Re-enablement requires canonical owner consent authority, independent Storage-enforced write authorization, and revocation/deletion proof.

## 5. Cumulative audit inventory inherited from R944–R953

The permanent Jobs audit PR [#379](https://github.com/LifeLoggerAI/urai-jobs/pull/379) contains the cumulative forensic pack and detailed R944–R953 history. Use its START NEXT CHALK file, source/runtime/cloud matrix, test ledger, P0–P3 taskbook, machine checkpoint, and later appended R945–R953 sections as the baseline.

Important inherited source facts:
- 27 exported Functions and 12 active runtime job types were identified in source; legacy registry taxonomy differs.
- Main source had 8 composite Firestore indexes versus 9 in a review candidate at the earlier audit point.
- Two privileged Studio GCS `createWriteStream` sites were identified and guarded by the hard-off path.
- The Jobs `main` SHA recorded in the R944 forensic inventory is `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`. Confirm current main before acting; this handoff does not claim it is still the tip.
- GitHub branch API reported `protected:false` for main at the R944 inspection. Recheck branch protection/rulesets and effective required checks before any merge.
- R948 source inventory reported 77 root commands and 111 direct/first-level nested source references. R952/#389 increased the reviewed root enrollment to 78 unique command segments. Neither count is evidence that the commands executed.
- Historical Jobs #320 reported 695 TAP cases at a different historical source revision. Do not combine that result with current #389 as if it were current full acceptance.
- Historical static Rules suites, synthetic fixtures, source-extracted tests, and isolated Node tests must retain their own evidence classifications. Do not add repeated runs of the same cases as new distinct coverage.
- CI failures previously included workflows that failed before recorded steps and log retrieval errors. Do not invent a source/test failure cause when no job steps ran.

## 6. P0–P3 release blockers — still open

### P0 — Storage revocation and private media
1. Prove that after consent/revocation, every privileged and alternate writer receives a real Cloud Storage **403** for a future write.
2. Drain or fence in-flight uploads; establish exact generation/version identity; verify deletion of the exact object generation and durable acknowledgement.
3. Prove that no stale service identity, alternate worker, signed URL, resumable upload, or inherited IAM grant can write after revocation.
4. Prove a positive, owner-authorized consent → Privacy authorization → Studio plan → Jobs render → protected private output → Spatial Replay path, followed by revocation, deletion, and downstream purge acknowledgement.
5. Keep production private-media paths hard-off until this is independently certified.

### P1 — Native integration and governance
1. Execute the full original standalone R951 authentication test on a complete checkout at one immutable reviewed SHA.
2. Execute all **78** root command segments on that same SHA; capture exact command list, exit codes, logs, and SHA-256 digests.
3. Execute builds and typechecks.
4. Run all four disposable Firebase emulators with synthetic identities/data and prove positive and negative behavior, including current-owner binding, Rules denial, auth, quota/idempotency, revocation, and deletion fences.
5. Exercise actual HTTP auth middleware for each worker: missing token, malformed token, wrong identity, revoked token, valid token; include production/staging with emulator flag set and local/emulator behavior.
6. Restore protected CI with successful required checks, independent eligible reviewer approval, and no bypass.
7. Certify an operational rollback rehearsal against a known deployed/staging revision.

### P2 — Application policy and data correctness
- Resolve and test post-admission data-rights execution/revocation semantics (Jobs #376). Preserve legitimate user deletion/export completion only under a durable, explicitly approved authorization model.
- Complete Firestore Rules user-binding native tests (Jobs #380).
- Verify quota concurrency and deployed index parity.

### P3 — Live provider inventory and deployment provenance
Perform an authenticated read-only census of actual Firebase/GCP resources, including project IDs/numbers, databases, installed indexes, deployed Functions, Storage buckets, IAM principals and inherited bindings, Cloud Run services/revisions/traffic/ingress/service accounts/secrets, Tasks, Scheduler, Pub/Sub, Eventarc, logs, quotas and billing. Record each resource's deployed source/image digest and compare it to the approved reviewed SHA. A repository config file is not evidence that the resource exists or that its live configuration matches.

## 7. Required next-worker execution order

1. Read the entire Jobs #379 PR body and all linked R944–R953 reports, especially R949–R953.
2. Read Jobs #386–#389 metadata, changed files, diffs, workflow checks, and all R954 test receipts. Identify exact parent/head SHAs and verify that no review branch moved.
3. Obtain the filenames and exact SHA-1 blob hashes for the five complete R954 worker sources; independently recompute and match them.
4. Re-run the original standalone R951 test unchanged on a full repository checkout. Do not rely on the adapted R954 harness as a substitute.
5. Run the full 78-command verification on one immutable source SHA, with frozen dependencies, Node/pnpm/Java versions recorded, full output persisted, and no hidden command skipping.
6. Build/typecheck; run disposable Firebase emulators; then run actual HTTP middleware negative/positive tests using synthetic identities.
7. Reconcile the rollback scripts and rehearse rollback only in an authorized isolated environment.
8. Obtain an independently authorized read-only live resource/IAM inventory. No production writes.
9. Resolve and independently prove P0 Storage revocation and private Replay/purge. Preserve hard-off until then.
10. Update Jobs #379 and Genesis #304 with exact source SHAs, test receipt digests, CI status, unresolved blockers, and any newly proven facts.

## 8. Evidence vocabulary — mandatory

Use these labels consistently:

- **Source inspected:** code/configuration reviewed; no execution implied.
- **Git object matched:** exact file bytes match a named Git blob/tree; no runtime implied.
- **Isolated/synthetic test:** local harness or fake provider objects; no real Firebase/GCP behavior implied.
- **Native emulator test:** actual disposable Firebase emulators used; still not production.
- **HTTP integration test:** actual service middleware/route invoked; live deployment still not implied unless run against the deployed revision.
- **Provider IAM proof:** effective live permissions and negative write behavior verified against actual GCP identities/resources.
- **Production acceptance:** requires all applicable source, runtime, IAM, deletion, observability, independent approval, rollback, and founder release gates.

Never convert “present,” “configured,” “enrolled,” “passed in an isolated harness,” or “Git hash matched” into “deployed,” “secure in production,” or “launch ready.”

## 9. Final release decision

**ONE URAI GENESIS — JOBS: PRODUCTION HOLD / NO-GO.**

No merge, production deployment, IAM change, Firebase Rules mutation, paid compute, real job dispatch, private-media access, or launch authorization is granted by this audit. Continue review-only, source-pinned reconciliation and authorized disposable testing. Production GO requires independent security review, successful protected CI, native integration acceptance, live provider proof, working rollback, and founder authorization.

---
*This document records the user-provided R954 test summary and the current GitHub metadata readback for Jobs #389, #388, #386, #379 and Genesis #304. Where an R954 receipt filename, source filename, digest, or hash is not available in the checkpoint, it is explicitly left for the next worker to recover rather than fabricated.*
