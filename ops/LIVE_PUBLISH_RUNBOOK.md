# URAI Jobs Live Publish Runbook

This runbook captures the final steps required to publish the standalone URAI Jobs Runtime live.

## Current repo status

The repository now includes:

- Local runtime verification: `pnpm urai-jobs:verify`
- Smoke verification: `pnpm urai-jobs:smoke`
- Build and typecheck gates
- System audit: `pnpm audit:systems`
- Production deploy/publish workflow: `.github/workflows/production-deploy-publish.yml`
- Worker deployment automation
- Worker URL export automation
- GCS bucket bootstrap automation
- Firebase deploy automation
- Worker verification
- Custom domain verification
- Deployment artifact stamping

## Required GitHub secret

At least one Google Cloud credential secret must exist before the deploy workflow can authenticate:

- `FIREBASE_SERVICE_ACCOUNT_URAI_JOBS`

or:

- `GCP_SERVICE_ACCOUNT_JSON`

A stable webhook secret is recommended but no longer required for the first deploy attempt because the workflow can generate a per-run fallback:

- `WEBHOOK_SIGNING_SECRET`

Recommended optional secrets:

- `PROD_SMOKE_ID_TOKEN`
- `WORKER_SERVICE_ACCOUNT_EMAIL`
- `MAILGUN_KEY`
- `MAILGUN_DOMAIN`

## Deploy workflow

Run this GitHub Actions workflow:

- `URAI Jobs Deploy Publish`

Inputs:

- `confirm_launch_unlock`: `LAUNCH-UNLOCK`
- `deploy_workers`: `true`
- `run_smoke`: `false` for first deploy

After `PROD_SMOKE_ID_TOKEN` exists, rerun with:

- `run_smoke`: `true`

## Expected workflow order

1. Require launch unlock.
2. Resolve or generate webhook signing secret.
3. Install Node 22 and pnpm 8.15.9.
4. Authenticate to Google Cloud.
5. Install dependencies.
6. Run local verification gates.
7. Create or verify the artifact bucket.
8. Deploy Cloud Run workers.
9. Export live worker URLs.
10. Run production env precheck.
11. Run system audit.
12. Deploy Firebase runtime.
13. Verify custom domains.
14. Verify workers.
15. Optionally run callable production smoke.
16. Stamp deployment artifact.

## Known custom domain issue

The current verifier has shown:

- `https://urai-jobs-563121397472.web.app` serves the expected app shell.
- `https://urai-jobs.web.app` serves the expected app shell.
- `https://uraijobs.com` returns HTTP 200 but does not serve the expected app shell.
- `https://www.uraijobs.com` returns HTTP 200 but does not serve the expected app shell.

This means Firebase Hosting is live, but apex and www are not routed to the correct Firebase Hosting site.

## Domain acceptance criteria

`pnpm domains:verify` must pass for all default URLs:

- `https://uraijobs.com`
- `https://www.uraijobs.com`
- `https://urai-jobs-563121397472.web.app`
- `https://urai-jobs.web.app`

## Firebase Hosting target

The configured hosting site is:

- `urai-jobs-563121397472`

Attach both custom domains to this Firebase Hosting site:

- `uraijobs.com`
- `www.uraijobs.com`

Then update DNS records using the values Firebase Hosting provides.

## Final acceptance criteria

URAI Jobs Runtime is live only when:

- `pnpm prod:precheck` passes in the deploy workflow.
- Cloud Run workers are deployed.
- Worker URLs are exported.
- Firebase deploy completes.
- `pnpm domains:verify` passes.
- `pnpm prod:verify-workers` passes.
- Deployment artifact is stamped.
- Optional callable smoke passes after `PROD_SMOKE_ID_TOKEN` is configured.
