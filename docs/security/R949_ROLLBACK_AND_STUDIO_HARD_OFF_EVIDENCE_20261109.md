# ONE URAI GENESIS — R949 rollback false-success repair and Studio hard-off evidence

**2026-11-09 UTC. REVIEW ONLY. NO-GO / PRODUCTION HOLD.** $0 spent; no cloud calls, real customer media/jobs, IAM mutation, secret reads, deployment, merge, rollback traffic action or paid compute.

## Refs and source identity

- Parent source review [Jobs #384](https://github.com/LifeLoggerAI/urai-jobs/pull/384), immutable source `fd05a376f876f9b835929a2074c09f47638659e2`. Parent retains 57/57 R879 Git source pins and 77 enrolled root commands; full native runtime NOT_RUN.
- Independent branch `review/chalk-r949-rollback-placeholder-hard-stop-20261109`, strictly child of the above. Does not rewrite peer worker, production main or canonical release workflow.
- Pre-change `.github/workflows/rollback-on-smoke-failure.yml` original blob `2cc2c0959d0537a94ffd84e7173d185322331d2c`: dispatch-only workflow checkout then print text `Previous stable revision would be restored here`, **without any revision restore command or failure**. It could appear green despite not rolling anything back.
- Review correction exact original blob `33cf1d462b0cb3460bb88fa53f5bced98a84a24e`: remove unnecessary checkout and print three explicit `[BLOCKED]` messages, then `exit 1`. Workflow remains manual-only.
- New original test `scripts/r949-legacy-rollback-hard-stop.test.mjs` Git blob `86d1673fb685c4e51f3cf3eec37d858093e64747`. Exact byte-matched GitHub original sources placed in an isolated local `/mnt/data/jobs_r949_verify` directory; no complete repo checkout.

## Original test actually executed, not a report-only claim

```sh
node --version        # v22.16.0
git hash-object .github/workflows/rollback-on-smoke-failure.yml scripts/r949-legacy-rollback-hard-stop.test.mjs
node --test scripts/r949-legacy-rollback-hard-stop.test.mjs
```

Actual **3/3 PASS, 0 FAIL, 0 SKIP, exit 0**, Node 22.16.0. Tests prove: manual trigger only; no checkout/actual cloud/network mutation in this workflow; extracting and executing the exact original `run: |` block in a sandbox Bash subprocess returns code 1 and reports the BLOCKED/approved rollback/HOLD messages. Original TAP log `R949_original_rollback_hard_stop_exact.tap`, **665 bytes**, SHA256 `8d81a13b83dadbe686ee2512566fcc75d445683088a6bf5096cfb8733c2ef9c9`. These checks are **offline source tests**, not GitHub Actions running, production traffic rollback or native Firebase acceptance.

## Separate actual rollback implementation — do not misclassify

- `scripts/rollback-cloud-run-workers.sh` blob `b05cdef551022cedaa4a9da64b502d1099120443` does contain `gcloud run services update-traffic --to-revisions ...=100`; this is a real mutation **if invoked**, but it was NOT invoked, and accepts project/default, service and revision inputs without proving protected authorization, account/org isolation, previous revision security and post-rollback health. Do not point the deprecated workflow at it without independent design.
- `scripts/verify-rollback-revision.mjs` blob `cbca016fb807ce1e0e48a2c41e46f1f7b26e7c40` performs source/image-digest/config/Secret Manager version provenance checks; `.github/workflows/urai-jobs-production-deploy.yml` blob `0bc4d67765ce128df2861b2cb8e4469c51d63f87` is the separate gated canonical deployment. Neither is the non-operational manual rollback workflow.
- `scripts/bootstrap-managed-worker-iam.sh` blob `da5c4e5511c587d83a16cbd82a96ffbb65e6f1c3` and `scripts/deploy-managed-worker.sh` blob `374ce0d8264f9764202cf6c22877265efc72f769` intentionally exit 1 before granting IAM/deploying generic workers. Earlier grants, actual IAM and external alternate paths remain unknown.

## Further source-confirmed P0 launch interlocks

At #384 source, `workers/studio-worker/index.js` Git blob `1b0e1fbcc76b4e9fc2fbd58863a33723f4513973` requires an authenticated bearer token but `lifeMovieConsentAuthorityAvailable()` returns **false**, which makes `POST /` return 503 `CONSENT_AUTHORITY_UNAVAILABLE` before rendering, and `/readyz` return 503. This is an explicit fail-closed source contract; not proof of live deployed endpoint status.

The studio worker's two private-output upload functions both call `assertPrivateOutputWriteAuthority()` before GCS `createWriteStream`. Actual `workers/studio-worker/private-output-write-authority.js` exact blob `ea6b25f3949ec2c17f65a9da68fa9cf937e86e76` always returns `false` and throws `life_movie_storage_enforced_write_authority_unavailable`. R949 independently executed **three isolated focused Node checks** on that exact original module: `privateOutputWriteAuthorityAvailable() === false`, expected exception thrown, and synthetic environment variables cannot enable it. **3/3 PASS**, not native cloud IAM. Worker code exists, but genuine private output is intentionally unavailable until a reviewed broker, consent authority and Storage IAM fence are integrated.

The canonical `scripts/deploy-workers.sh` blob `b42fdcb1748bcfd0d541c3fffa334401fdf9e3b3` uses `gcloud run deploy --allow-unauthenticated`; Studio handler applies bearer-token HTTP auth to private operations. **Public Cloud Run ingress versus application-token authorization must be verified against live IAM and endpoint behavior; no live deployment inferred.**

## Critical remaining acceptance

1. Independent review of this small fail-closed legacy rollback correction. Do not auto-merge. Leave real Cloud Run rollback procedure as a **separate** governed, tested flow with exact known-stable revision, owner/region/project identity, IAM and health restoration evidence.
2. Complete #384 original root **77 commands**, original 17-case idempotency and Auth/Firestore/Functions/Storage disposable R879 with required `--run-exact-review-only` and full same-SHA CI; source Git pins 57/57 and local Node tests alone cannot certify runtime.
3. P0 [Jobs #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252): real Storage-level stale/alternate privileged writer GCS 403 after revocation, in-flight upload drain, exact-generation purge ACK; positive trusted owner C6 → Studio→Jobs private MP4+SRT → Spatial owner-only Replay → post-revoke denial and downstream physical deletion.
4. P1 [Jobs #376](https://github.com/LifeLoggerAI/urai-jobs/issues/376) data-rights durable executor continuation and [#380](https://github.com/LifeLoggerAI/urai-jobs/issues/380) native Rules denial; protected CI, read-only live cloud resource and deployed SHA/IAM inventory, independent reviewer and founder GO all remain missing.

**No active release action, no paid tool use, no production change. ONE URAI GENESIS HOLD / NO-GO.**
