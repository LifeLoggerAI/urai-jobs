# URAI Jobs Live Publish Runbook

This runbook captures the final steps required to publish the standalone URAI Jobs Runtime live.

## Current repo status

The repository includes local verification, smoke verification, build/typecheck gates, system audit, production deploy/publish workflows, worker deployment and URL export, GCS bootstrap, Firebase deploy automation, worker/domain verification, and deployment artifact stamping.

## Required GitHub deploy identity

GitHub Actions deployment is WIF-only. Do not create or upload a service-account JSON key and do not use a Firebase CLI token as deployment authentication.

Configure these non-secret GitHub variables:

```text
GCP_WIF_PROVIDER
GCP_DEPLOY_SERVICE_ACCOUNT
URAI_JOBS_FIREBASE_PROJECT_ID
```

Google Cloud must separately trust the `LifeLoggerAI/urai-jobs` GitHub OIDC subject through the configured Workload Identity Provider, and the deploy service account must have only the permissions required for the governed deploy operations. The repository cannot prove those provider-side bindings by itself.

Required provider/application secrets remain separate from deploy identity. In particular, configure a stable `WEBHOOK_SIGNING_SECRET` before relying on external webhook verification. Optional runtime secrets include `PROD_SMOKE_ID_TOKEN`, `WORKER_SERVICE_ACCOUNT_EMAIL`, `MAILGUN_KEY`, and `MAILGUN_DOMAIN` where actually used.

## Deploy workflow

Run:

- `URAI Jobs Deploy Publish`

Inputs:

- `confirm_launch_unlock`: `LAUNCH-UNLOCK`
- `deploy_workers`: `true`
- `run_smoke`: `false` for first controlled deploy

After a short-lived `PROD_SMOKE_ID_TOKEN` is available, rerun with `run_smoke: true`.

## Expected workflow order

1. Require launch unlock.
2. Require WIF provider and deploy service-account variables.
3. Authenticate through GitHub OIDC + Google Workload Identity Federation.
4. Resolve application/provider secrets without treating them as deploy identity.
5. Install dependencies and run local verification gates.
6. Create or verify the artifact bucket.
7. Deploy Cloud Run workers.
8. Export live worker URLs.
9. Run production environment precheck and system audit.
10. Deploy Firebase runtime.
11. Verify Hosting/custom domains and workers.
12. Optionally run callable production smoke.
13. Stamp deployment evidence.

## Known custom domain issue

Historical verification showed the Firebase Hosting URLs serving the expected app shell while the apex/www custom domains were not yet proven attached to the intended Hosting site. Revalidate current DNS/Hosting state before changing that conclusion.

## Firebase Hosting target

Expected configured Hosting site:

- `urai-jobs-563121397472`

Custom domains intended for that site:

- `uraijobs.com`
- `www.uraijobs.com`

Use the DNS values Firebase Hosting currently provides; do not rely on stale copied records.

## Final acceptance criteria

URAI Jobs Runtime is live only when:

- WIF exchange succeeds for the exact repository and intended deploy service account.
- No long-lived JSON/token deploy credential is required.
- `pnpm prod:precheck` passes in the governed deploy workflow.
- Cloud Run workers deploy and verify healthy.
- Firebase deploy completes.
- Hosting/custom-domain verification passes for the intended release scope.
- Deployment artifact is stamped and retained.
- Callable smoke passes when enabled.

Until those provider/runtime receipts exist, production remains **NO-GO**.
