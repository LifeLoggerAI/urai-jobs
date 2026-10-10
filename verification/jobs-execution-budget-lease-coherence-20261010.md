# UrAi Jobs execution budget and lease coherence repair

Owner controller: #170, `repair/life-movie-convergence-20261007`.
Observed parent: `150347557567fff70743c06af25bf1f79ba47d7e`, tree `fb600bc2ceb211e6f5196fe727d6ae369dbaa662`.
Main remains `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`.

## Defects and correction

A stale RUNNING job previously recovered according to a fixed recovery count while ignoring its started execution count. A one-attempt provider job or an exhausted two-attempt reconstruction could therefore become PENDING again. Expired LEASED recovery and dispatcher start also accepted exhausted or malformed execution budgets. The repair validates the admitted numeric policy at dispatcher start, dispatch failure and both recovery paths. Started attempts remain distinct from lease/publication recovery. An active exact asynchronous callback remains protected until its deadline. The existing three-recovery ceiling remains intact.

Dispatcher start now reads master and queue together and requires their matching LEASED token. Dispatch, asynchronous acknowledgment, result, failure and revocation transactions require the RUNNING master, queue and execution token to agree. A queue-only replacement or changed master lease cannot be overwritten by an old result or failure. Stale runner recovery also checks the execution token, aligns both retry counts and records terminal completion.

## Reproduction and validation

Declared toolchain: Node 22.23.3, pnpm 8.15.9, frozen 513-package graph across 15 workspace projects. The official Node archive SHA256 was checked against its distribution checksums. TypeScript is the declared frozen Functions dependency.

The same 52-case actual-source scheduler/dispatcher regression produced **8 pass / 44 fail** against the exact parent and **52 pass / 0 fail** after correction. The cases cover exhausted and malformed budgets, transaction-time heartbeat/terminal/lease races, exact callback deadlines, divergent queue counters, missing/cancelled/replaced queues, final allowed execution and late HTTP 200/202/500 results. Explicit local Firestore and transport adapters are used; these are source behavior tests.

The retained actual dispatcher/Axios loopback suite passed 451 cases. Functions native compilation, execution guard smoke, queue recovery contract, frozen install and root lint passed. The native root `npm test` aggregate completed successfully on the final affected source; it includes the new regression, retained privacy/narrator/worker/dispatcher suites, all workspace builds, Functions typecheck, execution guards, deployment precheck and Career tests. The two external Model Forge fixtures remain explicitly skipped in the ordinary aggregate until its native pinned-Factory compatibility step supplies their dependency. No skip is an acceptance claim.

Reproduce from a clean candidate checkout:

```sh
pnpm install --frozen-lockfile
node --test scripts/job-recovery-attempt-budget.test.mjs
pnpm test
pnpm lint
```

To reproduce the predecessor failures, materialize its four `functions/src/jobs` source files in a separate directory and invoke `node scripts/job-recovery-attempt-budget.test.mjs --baseline-root=/absolute/predecessor-directory`. Use direct `node` for this comparison so the explicit argument reaches the test process.

## Authority and evidence limits

This scoped donor targets the existing owner branch. It does not advance the owner or main, merge, deploy, freeze, sign, enable a provider, authorize spend or grant artistic/device/independent approval. Hosted exact-head CI and owner admission must be read back separately.

No real private source, Auth/Firestore emulator, cloud Storage/PubSub, narrator/provider call, paid job or deployment was executed by these new cases. Genuine current source/consent/voice rights, protected billing/provider reservations, deployed authenticated workers, original private-memory delivery and actual device/visual acceptance remain open runtime dependencies.
