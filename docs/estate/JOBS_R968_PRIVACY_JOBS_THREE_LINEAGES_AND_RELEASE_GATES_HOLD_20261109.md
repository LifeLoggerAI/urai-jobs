# ONE URAI GENESIS — R968 Privacy/Jobs Revocation Lineage Reconciliation

**Checkpoint:** R968 · November 9, 2026  
**Release:** **PRODUCTION HOLD / NO-GO**  
**Purpose:** Continue the actual R967 handoff. R968 reconciles three separate Privacy/Jobs integration test lineages, refreshes Privacy #83's real source-vs-deployment status, and establishes an evidence-correct R969 entrypoint.

## 0. Executive result

R968 found no newer source or runtime acceptance receipt that closes the revocation integration gates. The useful progress this round is **lineage clarification**:

1. The Jobs #371 emulator harness is its own integration path. It expects a Privacy checkout containing `consent-jobs-delivery.ts`, `consent-jobs-http.ts`, and `consent-jobs-dispatch.ts`, exporting `deliverJobsConsentRevocation`. Its exact source provenance remains unrecovered.
2. The Privacy R647 donor is a different dispatcher library: `consent-revocation-jobs-dispatcher.ts`, exporting `dispatchPendingJobsRevocations`. It is not interchangeable with the #371 harness modules and it is not deployed.
3. The Privacy R818/R836 maintained native acceptance path is a **third** architecture. It exercises the original Jobs #320 compiled client against Privacy's actual callable using four disposable Firebase emulators; it does not load the missing `consent-jobs-*` modules. Its runner pins an older exact Jobs #320 HEAD and an exact Privacy HEAD.

These must stay separate. A pass or source inspection in one lineage cannot be transferred to another. No R968 tests, dependency installs, builds, emulators or cloud operations were executed.

Privacy issue #83's current source-status correction is also material: canonical consent decision and revocation source exists, while protected deployed runtime, downstream consumer ACK and provider-call suppression remain unproven. Do not repeat the stale original issue body as a current claim that no source exists.

## 1. Refreshed review graph

The following metadata was directly refreshed in R968. Recheck before any mutation; open/draft does not mean deployed.

### Jobs
| PR | Head SHA | State | Role |
|---|---|---|---|
| #320 | `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e` | Open draft | Older Jobs source pinned by R818/R836 runner |
| #371 | `df19633466eaebdda844569ed0d562245bd31dc6` | Open draft | R923 convergence and three-case emulator harness |
| #377 | `f8578ea281e818b01811aecc2fe4dfb8c3dc8203` | Open draft | R900 data-rights post-admission operator-withdrawal |
| #388 | `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38` | Open draft | R951 worker production-first auth |
| #389 | `b865209cc352241602d8b9714672f3401aed7669` | Open draft | R952 mandatory test enrollment |
| #390 | `e8ba07fc26f154169f2e065d9aa65e77014635d2` | Open draft | R932 Studio→Jobs Zod parser test |

### Privacy
| PR | Head SHA | State | Role |
|---|---|---|---|
| #214 | `cc0692053db3b1b8df8267d43856b1a3357de8a0` | Open draft | R647 legacy dispatcher donor |
| #229 | `79e71fd6137947d2ed7c416a2596090572fef978` | Open draft | R834 source pin |
| #230 | `846d2ffa469af5634374bd77fbdc2d41bca8e964` | Open draft | Converged Privacy build/static source line |
| #231 | `42aad96404c4f0de01a448031df80f7b5c06f7c0` | Open draft | R835 atomic full-native runner candidate |
| #232 | `e1e2dee63c39590d343d727aa53618ac97a52691` | Open draft | R836 two-parent convergence |
| #253 | `90a4e581e8494f52d85eab3c576d02b926e7d0d9` | Open draft | R17 canonical subject binding |
| #254 | `dbc193763dc112210c20b5b680e8eb08fdf8396c` | Open draft | R18 prior-grant identity |
| #255 | `a4d7e4ffb76fa2dbbf7348e2b66faa991761509a` | Open draft | R19 prior-grant evidence |
| #256 | `cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6` | Open draft | R20 outbox replay integrity |

## 2. Lineage A — Jobs #371 three-case cross-service emulator harness

Exact Jobs source:
- `tests/emulator/privacy-jobs-storage-revocation.test.mjs`
- blob `e9662a979a72a0e39a61fe896a79f8379658d963`
- R923 #371 HEAD `df19633466eaebdda844569ed0d562245bd31dc6`

The harness requires `URAI_PRIVACY_SOURCE_ROOT` with five modules:
1. `consent-revocation-transition.ts`
2. `consent-jobs-delivery.ts`
3. `consent-jobs-http.ts`
4. `consent-revocation.ts`
5. `consent-jobs-dispatch.ts`

It expects `deliverJobsConsentRevocation` from `consent-jobs-dispatch.ts`.

### Exact test scope
- Case 1: pending synthetic event; Jobs receiver performs known-reference derivative cleanup; per-consumer Privacy ACK is written; local Storage object is absent.
- Case 2: RUNNING attempt remains unresolved; Privacy refuses ACK, consent block persists, marker persists across retry; this is a fail-closed incomplete-cleanup case.
- Case 3: 110 synthetic Jobs / 30 plans with 85ms injected latency before Jobs transactions; synthetic performance fixture only.

### What it does and doesn't test
- Uses real local Firestore and Storage emulator APIs for fixture and cleanup operations.
- Runs the actual Jobs `ingestConsentRevocation` handler under a loopback HTTP server.
- Mocks Firebase Functions trigger/callable/HTTP wrappers and service actor/token.
- Directly seeds synthetic `life-movie.render` consent state. It is not an authorized production or registered C1 grant.
- Privacy publisher/dispatcher comes from an external Privacy checkout and is not present in the Jobs repository.
- Does not prove hosted service identity, Cloud Run IAM, privileged GCS future-write denial or historical erasure.

The harness is not included in the R923 root `urai-jobs:verify` package command. It is manually invoked through the documented `firebase emulators:exec` command. Do not claim that the 78 root segments execute this three-case harness.

### Source recovery status
- R967 searched GitHub code for the three exact filenames in the whole LifeLoggerAI organization; all four queries (three filenames and export symbol) returned zero results.
- R967 also searched three path-specific GitHub commit histories and got empty arrays.
- Direct path checks across the identified Privacy branch/tree list found no matches. The exact path set and checked refs are in the R967 audit and machine checkpoint.
- This is scoped negative search evidence only. It does not rule out a local archive, alternate repository, unindexed Git object, renamed module, or externally deployed implementation.

**Disposition A:** exact historical source provenance unresolved. Do not recreate and label as recovery, and do not substitute R647.

## 3. Lineage B — Privacy R647 dispatcher donor

Exact R647 #214 HEAD:
`cc0692053db3b1b8df8267d43856b1a3357de8a0`

Original source blobs:
- `functions/src/consent-revocation-jobs-dispatcher.ts`: `4126167b4350ba8afe6b19d7b60dec1ca891189f`
- `functions/src/consent-revocation-jobs-contract.ts`: `6cca2b9456319927cf22511c7d51c1f16ddf051c`
- dispatcher tests: `def1048aa4838f7ff990d792a27d1fb94e7f6441`
- contract/transport tests: `fd60261f1518a31a476e2e5fdfbe62f9d8acf2aa`

Export: `dispatchPendingJobsRevocations`, not `deliverJobsConsentRevocation`.

This is a prepared bounded dispatcher library, not an installed scheduler or deployed function. Historical tests have 10 and 16 top-level Node test declarations and use fake Firestore/mocked transport; they are not Firebase emulator tests.

R960 documented why it cannot be cherry-picked unchanged into Privacy R20:
1. R20 lacks R647's delivery queue fields.
2. R20 integrity hash includes prior grant receipt/evidence data.
3. R647 mapping discards prior-grant evidence fields.
4. R647 maps outbox creation time to source revocation time.

Reuse only after an explicitly reviewed new envelope, publisher, mapper, Jobs receiver and canonical ACK contract. Preserve R647 source as donor.

## 4. Lineage C — Privacy R818/R836 maintained native acceptance path

The exact maintained runner at Privacy #232/R836:
- PR #232 HEAD `e1e2dee63c39590d343d727aa53618ac97a52691`
- `scripts/run-r818-native-jobs-privacy-acceptance.sh` blob `589fbbb8cb4903946b3adc1b2aa707038e61d3df`
- `tests/integration/life-movie-jobs-native-transport.emulator.mjs` blob `cafd32784b4c95f72214938290637b819557f3bb`
- exact pinned Jobs source: #320 HEAD `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`

It uses exact clean Privacy and Jobs Git SHAs, Node 22, pnpm 8.15.9, Java, required local emulator endpoints, disposable project `demo-urai-privacy-integration-test`, no production credentials, and refuses non-demo project/bucket overrides.

Its stage order includes static source pin, frozen Privacy installs, Functions typecheck/build, frozen Jobs install, original Jobs owner/status test, full Jobs typecheck/build, compiled bridge check, then four Auth/Firestore/Functions/Storage emulators.

The native test imports the original compiled Jobs identity/transport module, signs in a synthetic owner using Firebase Auth emulator, calls the actual Privacy `setCanonicalConsent` callable to assert an unscoped generic C6 grant is rejected, then exercises the Jobs-to-Privacy consent decision transport using local emulator endpoints and deliberately constrained synthetic tokens. It is a negative/review-only acceptance path; it does not grant production consent or enable rendering.

### Evidence state at R836
- R835 (#231) runner-source wiring and checks were reviewed; PR body records 18/18 source/order checks.
- R836 (#232) true two-parent source convergence was read back and compared to both parents; source verification checks 8/8 passed.
- R836 full native four-emulator runner was **NOT RUN** on R836 exact source because local Firebase Functions worker socket creation returned EPERM; hosted CI lacked an executable-step certificate.
- Prior #230 local source/build tests and Jobs #320 695-case suite/typecheck/build were on their own exact earlier heads. Do not transfer those receipts to R836 as a new R836 native pass.
- R836 has no Jobs #371 harness three-module API; it is a separate runner/test path.

### Critical pin warning
R818/R836 pins Jobs #320 `ea8f016...`, while the newer Jobs #371 harness is based on #371 `df196334...`. The #320 complete suite's prior 695 TAP pass is valid historical evidence for #320 only. It is not a full verification of #371 or #389. A new acceptance pair requires explicit source comparison and repinning under review, not silently reusing the older SHA.

## 5. Privacy #83 — source implementation exists, runtime gate remains

Privacy issue [#83](https://github.com/LifeLoggerAI/urai-privacy/issues/83) remains **OPEN**.

The original July body says no decision service or revocation propagation exists. Later comments correct that source-status description:
- Oct 5 comments say canonical decision service, purpose registry, callable, revocation transition/outbox/ACK path and owner/system authorization were merged into Privacy main source.
- Nov 3 comments say canonical C1 must be proven deployed in the Firebase project and Functions region used by Spatial; signed owner grant/revoke, denied/expired/stale/cross-user behavior, downstream ACK and provider-call suppression remain required.
- Nov 3 comments report Rules divergence between Privacy and Spatial; isolated draft fixes are not proof that a shared project's effective combined Rules are correct.
- Nov 3 source note labels the canonical consent decision service implemented but not deployed. This must be checked against current live deployment receipt, not assumed.

Therefore the accurate issue disposition is **SOURCE IMPLEMENTATION PRESENT / PROTECTED DEPLOYED RUNTIME AND CROSS-SERVICE ACCEPTANCE NOT PROVEN**. Do not close #83 because source code exists. Do not claim complete revocation propagation or provider-call suppression.

## 6. Derivative cleanup boundary (Jobs #371)

Jobs source `functions/src/privacy/lifeMovieDerivativeRevocation.ts` blob:
`d441b4971d456f2e861b2640067cbde6a2dfff32`

Source strengths:
- binds references to server-owned job/plan, tenant, project and approved bucket;
- deletes exact object generations with `ifGenerationMatch`;
- refuses unknown/unattributed objects;
- preserves unresolved RUNNING/LEASED markers;
- blocks completion on invalid scope, missing list permission or unknown objects.

Not proven:
- future-write denial after revocation;
- stale/alternate privileged identity 403;
- resumable or in-flight upload drainage;
- all versions/soft deletes/signed URL/backups/history erasure;
- deployed IAM or physical purge across every consumer.

Receiver flags remain explicit: `privateOutputDeletionAcknowledged=false`, `storageWriteFenceVerified=false`. Jobs ACK, Privacy consumer ACK and physical provider purge are three distinct receipts. Never equate them.

## 7. Current global blockers carried forward

- Jobs main current at last refreshed R967 readback: `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`, tree `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`; branch protection disabled; required checks off; Rulesets empty. Re-fetch before action.
- Jobs #389 worker auth candidate open/draft/unmerged; 78 root commands enrolled, not run.
- Prior ten Actions failures at #389 had runner ID 0, no step records. Exact GitHub cause remains unknown. Do not blindly rerun.
- Jobs #252 P0 GCS revocation/upload-drain remains open.
- Jobs #376 post-admission rights completion remains open.
- Jobs #380 server-owned deletion-request binding Rules remains open.
- Jobs #345 quota concurrency remains open.
- Privacy #83 protected runtime/downstream ACK/provider suppression remains open.
- Studio consent authority and private GCS write authority are deliberately hard-off.
- Effective live Firebase/GCP resource inventory, deployed revisions/image digests, ingress, service identity, secrets and IAM remain unknown.
- Independent rollback, device/accessibility/visual acceptance, protected CI, independent reviewer and founder GO remain outstanding.

## 8. R968 execution record

Executed in R968:
- Refreshed Jobs #320/#371/#377/#388/#389/#390 and Privacy #214/#229/#230/#231/#232/#253–#256 metadata.
- Read the full Jobs #371 three-case emulator harness at exact blob.
- Read the R836 native runner and actual native transport test at exact blobs.
- Refreshed Privacy #83 and its six comments, including the later source-status corrections.
- Confirmed the R647 donor and R836 native acceptance are separate from the #371 harness.
- Reviewed the exact #320 old pin and historical 695-pass receipt, preserving its scope.

Not executed:
- Git clone/checkout or frozen installs;
- original R647 10-case and 16-case donor tests;
- R836 runner;
- Jobs #371 three-case emulator harness;
- build/typecheck for any new source head;
- hosted endpoint call or dispatcher execution;
- live Firebase/GCP inventory or effective IAM;
- real GCS 403, upload drain, exact-generation physical purge or downstream final ACK.

No application code, branch protection, CI runs, cloud provider resources, IAM, Firebase Rules, real jobs or private media were changed.

## 9. Exact R969 instructions

1. Read R968 report, machine checkpoint and R969 start prompt. Re-fetch all PRs/issues/branches first.
2. Recover exact source provenance of the three missing #371 harness modules from a source archive or identified Git ref. Do not fabricate or rename source. If unavailable, keep that harness NOT RUN.
3. Decide with Privacy/security owner whether to advance the R836 native denial/review-only path, the Jobs #371 local Storage-cleanup harness, or a new v3 architecture; do not merge their test scopes.
4. If R836 is selected, use the exact approved Privacy #232 source and Jobs #320 source pin unless a separately reviewed repin change is made. Run on a host supporting Firebase Functions Unix sockets; do not weaken runner protections or use production.
5. If #371 harness is selected, first source-pin the full compatible Privacy tree and its lockfiles; then run the local Firestore/Storage emulator cases. Treat the synthetic purpose fixture as non-authorizing.
6. Run the R647 donor unit tests separately from either emulator path.
7. Obtain privacy/legal/security review of R963–R965 event identity, source-time and ACK proposal before implementing a new dispatcher.
8. Prove Privacy #83 protected deployed C1 decision and revocation, all registered downstream consumer ACKs, provider-call suppression and effective deployed source/Rules.
9. Separately prove nonproduction GCS post-revocation 403 for every privileged/alternate writer, in-flight upload drain, exact-generation deletion and durable purge receipt.
10. Preserve independent Jobs auth, data-rights policy, Rules binding, quota concurrency, branch protections, hosted CI, rollback, C6, device/accessibility/visual and founder GO gates.

## 10. Final release disposition

**ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**

Do not merge, deploy, dispatch revocation events, enable private rendering, process private media, change IAM/Rules, use paid compute or declare GO as part of this audit. Source presence and local emulators do not establish protected production behavior. Unknown does not mean absent or safe.

---
*R968 is a documentation/source-reconciliation checkpoint. All hashes and branch heads are immutable snapshots; refresh before execution. No new tests or cloud operations were performed.*
