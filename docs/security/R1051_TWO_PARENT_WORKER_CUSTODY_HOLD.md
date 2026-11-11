# ONE URAI Genesis — R1051 independent-worker custody convergence (REVIEW-ONLY / HOLD)

## Immutable construction
- First parent: Jobs #431 `30dbffdaee77684c904750e7099762ba551e504e` (two-parent #429 + #428), source tree `76695bf145a53181b77fc26ad6dcccb1c655fa01`.
- Second parent: Jobs #430 `b8abb70c84d4001404feef62abce7a41eda8d8e7` (linear descendant of #429 preserving #427's unique regressions), tree `c7eefb226fc4a727d1ca6b9484b59864e7a39368`.
- This R1051 merge uses #431's exact tree as base, overlays exactly three #430 blobs, and adds this ledger; parent commits and original branches remain untouched.
- Overlays: `scripts/life-movies-write-reservations.review-emulator.mjs` blob `2bb99954cd60f4d67ef1094921725728576168f8`; `scripts/r1042-canonical-revocation-veto-wiring.test.mjs` blob `ac294403399b4e3b8e2a985bb4ed0dccc863ccc5`; `docs/security/R1050_THREE_WORKER_MERGE_CUSTODY_NO_GO.md` blob `e02b136b1e591f2f2b219a1ffe7a07647ae82fb4`.
- #431 already retains `docs/security/R1049_TWO_PARENT_SECURITY_VERIFICATION_CUSTODY_HOLD.md`, the R1047 hermetic credential guard, R1046 owner/consent gates and #428 native-pass provenance. R1050's original note saying it was linear and lacked multiple ancestry describes the R1050 historical head, not this later R1051 merge.

## Preservation and evidence boundaries
- #427's unique emulator owner disable/delete, cancelled job, and owner/tenant/source/project/purpose drift fixtures are now present without losing #428's unresolved active attempt / no deletion ACK and #429's synthetic-only credential guards.
- Real Git parent custody now covers #430 and #431, with #431 itself containing both #428 and #429 parents. This does not make #427 a literal ancestor, but its distinct code and assertions remain preserved. Do not squash, delete, close or replace the donor PRs before independent approval.
- Source review found #430-versus-#431 script delta to be additions only; no production worker edit was proposed in this merge. The unconditional private-output worker hard-off remains unchanged. This is a **review-only** emulator model.
- R1048 Privacy #271 tests target Jobs #428 exactly. Older 4/4, 21/21, full Jobs and Privacy negative four-emulator passes belong only to their recorded original SHAs; they are **not** R1051 acceptance.
- Independent R1051 exact-head frozen install, root suite, Functions build, four-emulator negative and positive scenarios, real staging GCS 403, and authenticated full lifecycle are **NOT RUN** in this merge construction. Must test with a credential-isolated approved runner and pin new SHA/tree in Privacy runner. Avoid credential-bearing Runpod until P0 Labs #370 is contained.

## Security and release P0
1. Labs #370: reported Runpod key exposure in private provider logs; verify provider key revocation/rotation and audit review before credential-bearing compute. Do not retrieve/reprint any keys or raw log material.
2. Jobs #252: production equivalent sole trusted GCS writer and IAM old/alternate identity 403, durable reservations before upload, in-flight upload drain/quarantine, generation-bound delete and post-revocation no-write proof; never treat emulator simulation as cloud enforcement.
3. Authenticated owner-positive consent -> Privacy -> Studio -> Jobs -> protected private Replay -> withdrawal -> generation-specific deletion/ACK, with cross-tenant denial, signed identity and rights proof.
4. Protected CI plus genuinely independent reviewer, rollback demonstration, real device/accessibility/AAA++ visual acceptance, legal/locale/distribution prerequisites, then founder GO.

**Status: NO-GO / Genesis HOLD.** No protected-main merge, no production IAM or Storage Rules change, no grant, no private writes, no live user media, no Vercel deployment and no source-equivalence claim without an independently executed exact-source receipt.
