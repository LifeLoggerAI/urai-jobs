# Jobs runner/security source convergence — 2026-11-10

Production HOLD. Continuation of existing #399, preserving parent 54bf333095e14c055da614303238c48e63618745. Donor #402 f82bd26ae5b2363017fe649e62949e724f7295f4.

## Implemented
Recovered exact donor runner blob 581b2377c9c227c2c1a99330642f08ab12cdcd1f and test blob fa06651b64bde1a92fc7473fcd87efe797814f03. Shared checkout helper identical on both sources (1d941569a518cdf934462dd1a0bd71d9cf08ac7c). Retained #399 package script enrollment of R998 and R1001. No broad branch merge.

Found and repaired actual schema incompatibility: existing R998 auditor accepted only R997 receipts while donor emits R1000. Added backward-compatible R1000 validation with mandatory install/toolchain file hashes, regular-file/symlink checks and explicit precheck/install/mutation exit semantics. Original non-certification flags remain false.

## Executed validation
Node v24.22.1: node --test tests/r998-verify-r997-local-receipt.test.mjs scripts/review-only/r1001-private-output-broker-contract.test.mjs: 55/55 PASS, exit 0. Existing shell runner regression attempted on this host and stopped exit 125 because runner requires Node 22; no native acceptance claimed. bash -n on donor runner/test passed. Full frozen install, composite suite and exact combined-commit Node 22 regression remain pending. Historical R1002 native PASS applies only to donor source, never this new combined source. Local tests validate mocked receipt and review-only input contracts, not cloud authorization.

## Fresh discovery
19 accessible repositories. Runpod pagination exhausted: 339 Pods, 338 EXITED, R950 bvandlyauxhevl alone RUNNING listed $0.08/hour, no mounts. No resource mutations; evidence custody unresolved. Zero owned Serverless endpoints. Nov10 UTC partial daily account spend $8.030293429614176, includes $0.3841613210388459 Public Endpoints, not benchmark-only or final invoice. Vercel 4 projects, 8 deployments (5 READY, 3 ERROR); historical READY records do not certify current UrAi release. Gmail search found recent startup-failure notifications and a Nov9 good-standing notice for one Google Cloud billing account; effective project billing and IAM remain unverified.

## Next dependency
Run exact combined commit in Node22/pnpm8.15.9 with full exported logs; independently check protected CI and review. C6 positive signed consent, exclusive Storage writer/IAM, authenticated full private lifecycle, live cloud authority/rollback, device/accessibility/AAA founder acceptance remain blocked or unverified per existing master ledger. Keep private writes hard-off. No merge or deployment.
