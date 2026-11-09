# ONE URAI GENESIS — R967 historical Privacy source recovery and emulator harness provenance audit

Date: 2026-11-09 UTC  
Disposition: **PRODUCTION HOLD / NO-GO**  
Scope: refreshed PR metadata; Privacy branch/tree/history inspection; exact Jobs harness/package/config readback; Privacy issue #83; read-only Git remote retry. Documentation only. No source edits, installs, tests, emulators, endpoint dispatch, provider inventory, IAM, merge, deploy, paid compute or private media.

## 1. Executive result

R967 searched the Privacy historical branch line most relevant to the Jobs #371 cross-service emulator harness for its three expected modules:
- `functions/src/consent-jobs-delivery.ts`
- `functions/src/consent-jobs-http.ts`
- `functions/src/consent-jobs-dispatch.ts`

None was found in the exact immutable Privacy trees inspected: R818, R819, R823, R824, R825, R826, R834, R836, R506/#192, R583/#213, R647/#214, or R20/#256. GitHub path-specific commit-history requests for each exact path returned empty arrays.

Those same trees do contain a different historical donor:
- `consent-revocation-jobs-dispatcher.ts` blob `4126167b4350ba8afe6b19d7b60dec1ca891189f`
- `consent-revocation-jobs-contract.ts` blob `6cca2b9456319927cf22511c7d51c1f16ddf051c`

This R647 API exports `dispatchPendingJobsRevocations`; the Jobs #371 harness expects `deliverJobsConsentRevocation` from `consent-jobs-dispatch.ts`. These are not the same module or function.

**Correct classification:** Jobs' harness references a Privacy source interface whose exact implementing source revision has not been recovered. Do not represent R647 as that implementation. Do not fabricate replacements or rename a different API to make the harness load. This does not prove that an equivalent implementation never existed under another name, in a non-GitHub archive, private workspace or external deployment.

## 2. Refreshed review graph

All inspected relevant PRs remained open/draft/unmerged at R967 read time:

| Repo / PR | Head SHA | Purpose |
|---|---|---|
| Jobs #379 | `49d0c611d6b700189236f9b5ae863306dd93021f` pre-R967 writes | Forensic docs |
| Jobs #371 | `df19633466eaebdda844569ed0d562245bd31dc6` | R923 convergence/harness |
| Jobs #377 | `f8578ea281e818b01811aecc2fe4dfb8c3dc8203` | R900 operator-withdrawal |
| Jobs #388 | `17b8f53ac1f4c75ac2abdd50a3bd631e61196c38` | R951 worker auth |
| Jobs #389 | `b865209cc352241602d8b9714672f3401aed7669` | R952 auth regression |
| Jobs #390 | `e8ba07fc26f154169f2e065d9aa65e77014635d2` | R932 Studio→Jobs parser |
| Privacy #192 | `7f5f4ad2f157a9d3eb4ed12b679d499fe5888bdc` | R506 four-emulator bridge |
| Privacy #213 | `4a4656d6283aa7e627bf220b447436df82865f99` | R583 bridge lineage |
| Privacy #214 | `cc0692053db3b1b8df8267d43856b1a3357de8a0` | R647 dispatcher donor |
| Privacy #229 | `79e71fd6137947d2ed7c416a2596090572fef978` | R834 native source pin |
| Privacy #230 | `846d2ffa469af5634374bd77fbdc2d41bca8e964` | Full source/native gate |
| Privacy #232 | `e1e2dee63c39590d343d727aa53618ac97a52691` | R836 two-parent native gate |
| Privacy #253–#256 | R17–R20 immutable heads | Subject binding, prior grant lineage, replay integrity |

Jobs main remains prior readback `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`. These source refs do not prove deployment.

## 3. Branch inventory and tree results

Privacy branch API returned three populated pages (217 branches total). Relevant branch heads included:
- R818 `f9e7786854f7ec70cab9a6e22d2c90ad95b834ed`
- R819 `dbe0b9df13cf7c25f1390fe13ae649908c695a15`
- R823 `2fe7ae334eb669af7d45cd1f4741a1be87ce9f73`
- R824 `03e48cbe8e1aaf25934b0e6cbf504552472f03bb`
- R825 `3f336b346ea899062ede6f41bb8dad44ba6de7e3`
- R826 `ccf5f5b2a2370ec25f5c32f37ce5d33e29ed2da9`
- R834 `79e71fd6137947d2ed7c416a2596090572fef978`
- R836 `e1e2dee63c39590d343d727aa53618ac97a52691`

Their recursive trees contain the R647-named dispatcher/contract but not the three `consent-jobs-*` files. R506/#192 and R583/#213 recursive trees show the same pattern.

The R818–R836 source line also contains its own different acceptance assets:
- `scripts/run-r818-native-jobs-privacy-acceptance.sh`
- `tests/integration/life-movie-jobs-native-transport.emulator.mjs`

Those runners/tests are a separate integration lineage. Do not conflate them with the Jobs #371 three-case `tests/emulator/privacy-jobs-storage-revocation.test.mjs` harness.

## 4. Jobs #371 harness facts

Jobs test file:
- path: `tests/emulator/privacy-jobs-storage-revocation.test.mjs`
- immutable blob: `e9662a979a72a0e39a61fe896a79f8379658d963`
- three top-level tests.

It requires `URAI_PRIVACY_SOURCE_ROOT` pointing at a complete Privacy checkout with five modules:
1. `consent-revocation-transition.ts`
2. `consent-jobs-delivery.ts`
3. `consent-jobs-http.ts`
4. `consent-revocation.ts`
5. `consent-jobs-dispatch.ts`

The three test cases exercise local Privacy→Jobs deletion/ACK, refusal to ACK when an in-flight attempt is unresolved, and a synthetic 110-job/30-plan workload with injected 85ms per-transaction latency.

Harness wiring:
- real local Firestore and Storage emulator APIs for synthetic fixtures;
- real loopback HTTP server around Jobs `ingestConsentRevocation`;
- mocked Firebase trigger/callable/HTTP wrappers, synthetic token and actor;
- synthetic `life-movie.render` record inserted directly—the test comments explicitly say this is not a registered purpose or authorized grant.

The R923 root `package.json` `urai-jobs:verify` script does not include this test; it is manually invoked, not part of the listed root verification sequence. `docs/CONSENT_REVOCATION_REPLAY.md` blob `31886c5ce46a39f2a0424aa377c157874a62ac84` documents the command:

```bash
URAI_PRIVACY_SOURCE_ROOT=/path/to/compatible/privacy-checkout firebase emulators:exec --project demo-urai-jobs-cleanup --only firestore,storage 'node --test tests/emulator/privacy-jobs-storage-revocation.test.mjs'
```

This is a reproduction command, not an R967 execution receipt.

## 5. Jobs derivative cleanup source boundary

Jobs #371 source `functions/src/privacy/lifeMovieDerivativeRevocation.ts`, blob `d441b4971d456f2e861b2640067cbde6a2dfff32`, demonstrates:
- tenant/project/bucket-bound output reference validation;
- generation-pinned Storage deletion with `ifGenerationMatch`;
- refusal to delete unknown/unattributed objects;
- persistent marker for unresolved RUNNING/LEASED attempts;
- bounded batches that settle before erroring;
- explicit `privateOutputDeletionAcknowledged: false` and `storageWriteFenceVerified: false`.

Its source expressly says prefix listing is a point-in-time check, not a future-write fence. It does not certify all historical artifacts, all object versions/soft deletes, signed URL invalidation or backup erasure. The emulator's unresolved case keeps the marker and refuses Privacy ACK, even when the known referenced object is removed. A reviewed reconciliation owner/procedure remains required.

## 6. Privacy issue #83 remains open

Privacy issue [#83 — RUNTIME GATE: deploy and prove consent decision + revocation enforcement](https://github.com/LifeLoggerAI/urai-privacy/issues/83) was read directly and is OPEN.

Its original July description says a decision service/revocation path is absent, but later comments correct that as stale source status:
- Oct 5: current main includes canonical decision service, versioned purpose registry, revocation transition/outbox/ack path and owner/system authorization; protected deployed runtime still needs proof.
- Nov 3: canonical `setCanonicalConsent` deployment and signed owner grant/revoke must be proven in emulator and protected staging, including downstream revocation ACK and provider-call suppression.
- Nov 3: Privacy/Spatial Firestore/Storage rules diverged; source patches exist but shared-project authority and deployed effective rules remain open.

The current gate is **protected runtime, downstream consumer acknowledgment and provider-call prevention**, not absence of source implementation. Required acceptance covers grant/deny/revoke/expiry/missing/renewal/race/retry/offline stale-state, downstream ACK, provider-call prevention and cross-user/tenant denial. Do not close #83 on source-only evidence.

## 7. Distinct R836 native acceptance lineage

Privacy #232 R836 is a two-parent convergence candidate. Its PR body records the Jobs/native verification sequence: exact clean Privacy+Jobs SHAs, frozen installs, original Jobs owner/status test, full Jobs typecheck/build, and original Jobs→Privacy callable denial/review-only issuer emulators.

The PR body says full four-emulator acceptance had not passed on the newer exact source because Functions worker Unix socket creation returned EPERM; hosted CI had no executed-step certificate. Previous #230/#320 build passes must not be transferred to #232.

R836 uses the R647 donor file names and a maintained separate native runner. It does not supply the missing `consent-jobs-*` modules expected by Jobs #371 harness.

## 8. R967 actual execution and limitations

R967 performed:
- metadata refresh of 16 relevant Jobs/Privacy PRs;
- Privacy branches inventory (217 branch records across three pages);
- recursive tree checks for 8 R818–R836 heads plus R506/R583/R647/R20;
- GitHub path-history requests for all three missing module paths (empty arrays);
- Jobs harness/package/Firebase config/replay-doc readback;
- Privacy issue #83 and comments readback;
- direct container Git remote test.

Actual command:
`git ls-remote https://github.com/LifeLoggerAI/urai-privacy.git refs/heads/review/r647-jobs272-source-lineage-hold-20261104`

Result: exit 128 — `Could not resolve host: github.com`.

Therefore R967 did NOT run donor tests, the Jobs three-case emulator harness, R818/R836 native runner, dependency install, build, typecheck, endpoint delivery, cloud inventory or GCS IAM. No application changes occurred. DNS failure is an environment blocker, not a test failure.

## 9. R968 exact next steps

1. Recover original provenance of the missing three `consent-jobs-*` modules only from a source archive/workspace/repository identified by evidence. Do not recreate and label it recovered.
2. Compare R818/R836 runner and `life-movie-jobs-native-transport.emulator.mjs` against the Jobs #371 harness and R647 dispatcher; decide one reviewed integration path.
3. Keep Privacy issue #83 open until protected deployed decision runtime, all registered downstream revocation acknowledgements and provider-call suppression are proved.
4. On a Git-connected host, obtain clean detached checkouts at exact R647, Jobs #371 and Privacy R836 refs; verify commit/tree/blob identities and lockfiles.
5. Run separately: R647 10-test dispatcher suite, 16-test contract suite, Jobs #371 three-case emulator harness if compatible Privacy source recovered, and R818/R836 maintained native runner. Capture raw logs, versions, exit codes, source hashes.
6. Use demo-only projects and synthetic records; direct fixture writes are not positive consent grants.
7. Separately verify actual deployed function revisions, source fingerprints, service identities, secret audience, ingress and effective IAM.
8. Prove nonproduction stale/alternate GCS writer 403, upload drain, generation-bound cleanup, final object absence and durable purge ACK.
9. Keep worker auth, operator-withdrawal policy, CI/protection, rollback, C6 lifecycle, device/accessibility/visual and founder GO as independent gates.

## 10. Final R967 disposition

**Confirmed:** the Jobs harness expects a Privacy source module set not present in the inspected Privacy branches; R647 is a different API; R818/R836 is a different native acceptance lineage; Jobs #371 root verify does not enroll the three-case harness; Privacy issue #83 remains an open protected-runtime/downstream-ACK gate.

**Unknown:** whether the missing modules exist in a non-GitHub archive, original local workspace, other repository or external service; actual deployed dispatcher/runtime and provider IAM.

**NOT RUN:** donor tests, Jobs emulator harness, R818/R836 native runner, install/build/typecheck, cloud inventory and GCS acceptance.

**NO MERGE / NO DEPLOY / NO DISPATCH / NO PRIVATE MEDIA / NO IAM CHANGE / NO PAID COMPUTE. ONE URAI GENESIS — PRODUCTION HOLD.**
