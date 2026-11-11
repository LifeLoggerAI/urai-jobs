# ONE URAI Genesis R1062 — credential-shaped launcher environment preflight (REVIEW / HOLD)

## Source and purpose
Child of Jobs #444 exact reviewed head `853d3dde8fbec3d8c9476130f489774b340911ea`, which retains Jobs #443's historic worker convergence and the new R1061 hard-disabled exclusive-broker boundary. This child adds a separate non-production safeguard to the four-Firebase-emulator acceptance launcher **before git, Node, pnpm and dependency installation**. It does not change production rendering, IAM, Firestore, Storage, consent, or protected deployment controls.

The existing launcher rejected named credentials such as RUNPOD_API_KEY, but its fixed list did not cover inherited `NPM_TOKEN`, `VERCEL_TOKEN`, `AWS_ACCESS_KEY_ID` or arbitrary `*_API_KEY`. Such variables could otherwise remain available to package installation lifecycle scripts. The new preflight inspects exported environment variable names, rejects nonempty credential-shaped names, and prints only the offending NAME, never its VALUE. Existing SHA pinning, Node option denial, emulator-only project restrictions and private-write hard-off remain unchanged.

## Exact reproducible isolated evidence
- Original launcher Git blob `277425086e6004354f56734d84b0c3e3a3e45fe6`; original root package.json blob `61c1b0e7fba94d05b3f8e9a56e6af71a3417a94e` read back unchanged from Jobs #444 at patch creation.
- Final tested launcher source blob: `ace7486c2d9da1345f9b1d66e9f9c198a1316938`.
- New isolated test file blob: `a635ecdf1eaad5e722e238508710eec7b841e1ab`.
- Root Jobs verifier enrolled the new R1062 test through package.json blob `1c8c089b21ad369526400811aa4551bf109dce0b`.
- Isolated Node v22.16.0: `node --test scripts/review-only/r1062-launcher-credential-env.test.mjs` => **4/4 PASS, 0 FAIL**; `bash -n scripts/run-four-emulator-acceptance.sh` PASS.
- Test TAP SHA256 `871e41fb1511c2bec1f277eec5c6bb7e52f5f437f1bcf73126d6a8ba9d10ab12`.
- Synthetic `NPM_TOKEN` demonstration: the original launcher advanced to its source-SHA check, while the patched launcher denied the inherited credential name immediately. No actual credential values inspected.

## Release boundaries
This review-only patch is NOT proof of full Jobs #444 native verifier, Auth/Firestore/Storage/Functions emulators, live GCS sole-writer IAM, physically drained uploads, deletion ACK, positive consent-to-Replay, or protected CI. Concurrent Jobs #444 changes have been preserved. Labs #370 exposed Runpod key has no verified provider-side revoke receipt; Jobs #252 exclusive broker is still a fail-closed placeholder and production write authority remains disabled. Do not merge into main, enable private-media writes, deploy production, alter IAM or claim Genesis launch GO.
