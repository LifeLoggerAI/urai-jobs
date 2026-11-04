# R571 — read-only IAM + Life Movie revocation race convergence (review only)

**Status: DRAFT / HOLD. No production authority, deployment, IAM mutation, owner consent issuer, Studio write broker, or release approval.**

## Scope and source identities

The first parent is Jobs draft #261 at exact immutable commit `b7a498e543160e64748a0679469a1fc1550acb3b`, Git tree `f655a6200ff12106de49faa678d54db707d21549`. Its guarded Studio direct-output writer remains **unconditionally disabled**; this integration does not replace it with a test flag or grant. This review bundle introduces six existing original-source artifacts, by exact Git blob SHA without modification, from four independent Jobs reviews:

- #254 `4b1f60998f01f3b2d659f1a7898a03984547ec6d`: Firestore transaction **emulator-only** owner/tenant/project epoch and reservation model (two files). It recognizes OPEN -> FENCING only and always denies completed revocation ACK.
- #255 `cb34ec72afe5aa451e5f5102ec0dc0648183b970`: deterministic pure-Node race transition model and negative cases (two files).
- #256 `b652c7e169461fa5f33ca1b923291b8b9d3c08d5`: durable-write-fence acceptance RFC (one file).
- #258 `7a4a3cf1439de2344d8c75c95899237915725d01`: actual Firebase emulator **negative demonstration** that old privileged Admin Storage writes can bypass Firestore-only revocation (one file).

The new commit records all four ancestors as additional Git parents, but its working tree is anchored to Jobs #261 with these exact six non-overlapping files added; no worker, IAM or production revocation implementation is changed. The only existing-file edit enrolls the pure race model test in `npm run urai-jobs:verify` and adds a separate explicit emulator-review command. No Firebase emulator, cloud credentials or launch gates are invoked by simply importing this review-only test model.

## Exact review commands

1. `node --test scripts/life-movie-writer-fence-race-model.test.mjs` — no network or cloud.
2. `npm run urai-jobs:verify` — original maintained root checks now include the pure model.
3. `npm run build --prefix packages/shared-types && npm run build --prefix functions` — original workspace TypeScript build (review-only model is compiled, not exposed).
4. `URAI_EMULATOR_PROJECT=urai-staging-test firebase emulators:exec --project urai-staging-test --only firestore,storage "npm run life-movies:write-fence:emulator:review"` — only on an isolated disposable emulator host, with all cloud credentials absent. These tests may succeed while proving that Admin Storage can still write after withdrawal: that is an intentionally **negative security result**, never an approval to enable writes.

## Source/decision rules

Prior R570 Privacy #208 36/36 and four-service 23-check original-source success is for Jobs `b7a498e543160e64748a0679469a1fc1550acb3b`, **not** this new Jobs commit or its newly compiled artifact manifest. Do not substitute this newer SHA into Privacy until independent exact-head frozen build, new generated-tree evidence and cross-repo source-pin revalidation are obtained. Do not erase the earlier source review receipts.

Even a 100% passing synthetic/emulator run here leaves P0 Jobs #252 OPEN: real effective production GCS IAM, historical and alternate credential denial, durable upload reservations, physical drain and generation-proven deletion, owner signed C6 and authenticated private Movie -> Spatial Replay remain unmet. GitHub-hosted required checks and independent review remain blocked. Genesis G0–G7: HOLD/NO-GO.
