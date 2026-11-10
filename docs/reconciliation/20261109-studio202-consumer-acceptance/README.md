# Studio 202 producer and Jobs consumer acceptance

Observed 2026-11-09. Review-only integration. Production HOLD.

## What changed

The enrolled Jobs producer-consumer regression only exercised the historical Studio #201 producer. Studio #202 fixed implicit RegExp string coercion for sceneTruthReceiptRef and sceneTruthDigest, but that newer implementation was not represented in the committed Jobs test. Add its exact source as a separate immutable fixture and extend the existing enrolled test. Preserve the original #201 producer, input and dispatch fixtures and all original tests.

The new assertions verify six exact source records by length, Git blob ID and SHA-256; reject both scene-truth fields supplied as JSON arrays; reject object coercion without invoking toString; preserve the valid historical payload and digest; prove the actual current producer still lacks required canonical consent; and keep the Jobs consent authority hard-false even when a dummy receipt passes schema shape.

The pinned HTTP dispatch route already normalizes these two fields through typeof string checks. The four red/green checks demonstrate the direct producer boundary and its consistency with the Jobs consumer; they do not establish an HTTP exploit or exercise authenticated HTTP dispatch.

No runtime application, Rules, IAM, workflow, package manifest or lockfile is modified. The existing functions test script already runs the changed test file. The native R879 source pins and commands remain unchanged. Source fixture code is test data, not a new runtime producer.

## Exact source authorities

- Jobs parent #390: e8ba07fc26f154169f2e065d9aa65e77014635d2.
- Studio producer #202: 501ac5c325f906cdeb32b0638dd15f5622ea1304, apps/studio/lib/studio-life-movie-jobs-bridge.ts, blob 9427263442d93c916516a76ae7b953585792be1a.
- Historical producer #201: a6187abfd12ffc8f534ddf66246da91ed032e1dc, blob 701be51e861e0a5ff47d88ceaba1e3812433d659.
- Studio #202 dispatch route: apps/studio/app/api/studio/video-factory/jobs-dispatch/route.ts, blob ef8e2bd124f7ea2da213d07fca3c5e82d80a056a; unchanged from the existing fixture.
- Jobs consumer schema blob: 5f944e906de7243d7415ac479cf92356b09c84c9.
- Jobs consent gate blob: 53761ac0f5c0340563b13fdd9a12a90e75409d42.

Complete pin records are in scripts/fixtures/studio-20261109-scene-truth-source-pins.json. Exact fixture and consumer bytes were fetched through the connected GitHub source and checked against Git object hashing before execution.

## Fresh executed evidence

| Check | Runtime | Result |
|---|---|---|
| Four new coercion checks with historical producer substituted at the new fixture path | Node 22.23.0 | Four failures, as expected |
| Existing synthetic-consumer suite plus extended actual-producer suite | Node 22.23.0, Zod 3.25.76 | 22/22 PASS, exit 0 |
| Original Studio #202 scene-truth regression | Node 20.19.0, TypeScript 5.9.3 | 5/5 PASS, exit 0 |
| Isolated Studio producer strict typecheck | Node 20.19.0, TypeScript 5.9.3 | PASS, exit 0 |

The 22 tests comprise 12 existing synthetic consumer tests and 10 historical/current producer-consumer tests. The five focused Studio tests are a separate execution of the original Studio test file; counts are not a full application or release total. Red-run substitution was restored before the passing runs and before commit.

Dependencies were installed with lifecycle scripts disabled in an isolated verification directory. The selected Zod version matches the source branch's locked version. Source files were hydrated individually, not checked out as a complete frozen workspace. No full Functions build, all-78-command Jobs verification, full Studio build, emulator, live HTTP, GCS, private media, device or protected CI acceptance was run in this pass. Original Studio #202 full local regression evidence remains separate and was on Node 24; these focused Node 20 checks do not replace a supported-runtime full build.

Raw logs, exact executed command arrays, exits and SHA-256 digests are alongside this file. Absolute workspace paths in the execution record describe the actual run; normal checkout commands are:

```sh
node --experimental-strip-types --test --test-reporter=tap scripts/studio-life-movie-create-zod-contract.test.mjs scripts/studio-life-movie-actual-producer-zod-contract.test.mjs
```

Run this under Jobs' declared Node 22 with the repository's frozen dependencies. In the separate Studio #202 checkout with its declared runtime and dependencies, run:

```sh
node --test --test-reporter=tap apps/studio/tests/life-movie-scene-truth-types.test.mjs
```

## Reconciliation of Jobs 390 and 391

Fresh Git commit objects show that Jobs #390 at e8ba07fc26f154169f2e065d9aa65e77014635d2 and #391 at 9f5759f072370fbd42a82560ff6c5d4f37169c6b share complete tree 4bd3d28a81d28f7507db98ce2f7359bb477e432a. Both recursive responses were non-truncated and their 1,470 path/object records matched exactly. The corrected test blob is 74e94da0a118a043ab76af611474f3f73d329cea in both.

The commit histories diverge (390 is two ahead and one behind 391). GitHub's compare response is relative to their merge base and reports a file diff; that does not contradict identical endpoint trees. Preserve both histories. This candidate is a child of #390; no force update, prior branch rewrite or production merge occurs.

## Release boundary and next action

The real Studio request remains denied because it contains no canonical life-movie.render consent. A schema-valid dummy receipt is only synthetic test data and cannot enable admission, rendering or public release. Do not copy a dummy into the producer or substitute ai.personalization.

Next, run the complete supported-runtime frozen acceptance for the chosen combined candidates; execute Privacy #258's authenticated denial-only Jobs-to-Privacy runner with visible logs; resolve the reviewed scoped issuer and Jobs #252 Storage-enforced future-write denial/upload drain; verify purge acknowledgement and protected Replay; restore protected hosted checks, independent release review, rollback and physical-device/visual acceptance. Those gates remain HOLD.

Sources: https://github.com/LifeLoggerAI/urai-studio/pull/202 ; https://github.com/LifeLoggerAI/urai-jobs/pull/390 ; https://github.com/LifeLoggerAI/urai-jobs/pull/391 ; https://github.com/LifeLoggerAI/urai-privacy/pull/258 ; https://github.com/LifeLoggerAI/urai-jobs/issues/252 .
