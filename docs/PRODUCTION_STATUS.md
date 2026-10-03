# URAI Jobs Production Status

Last updated: 2026-05-20

**Historical production evidence — not current V200 release authority.**

This document preserves a prior production deployment/verification record. Current Jobs V200 production lock remains **UNPROVEN / LIVE WORKER PROOF REQUIRED** under `LOCK.md`; historical deployment evidence must not be promoted to current release/runtime proof without fresh exact-SHA evidence.

Successful production deploy workflow run: 26189879850.

Verified gates:

- launch unlock
- Google Cloud authentication
- dependency install
- local verification gates
- artifact bucket verification
- Cloud Run worker deployment
- worker URL export
- production environment precheck
- system-of-systems audit
- Firebase runtime deploy
- canonical Firebase Hosting verification
- worker reachability verification
- deployment artifact stamping

Live canonical Hosting URLs:

- urai-jobs-563121397472.web.app
- urai-jobs.web.app

Cloud Run workers:

- narrator-worker
- asset-worker
- spatial-worker
- studio-worker

Production workflows:

- .github/workflows/production-deploy-publish.yml
- .github/workflows/post-deploy-verify.yml

Future deploy runs upload release evidence as the GitHub Actions artifact named urai-jobs-deployment-evidence.

Remaining external task:

- Route uraijobs.com and www.uraijobs.com to Firebase Hosting site urai-jobs-563121397472.

Tracking issue:

- issue 50, Route uraijobs.com and www to URAI Jobs Firebase Hosting

Conclusion: the historical runtime deployment record and smoke evidence remain retained for provenance. Current production deployment/runtime identity and worker proof require fresh exact-SHA evidence. Custom-domain DNS/Firebase Hosting attachment remains external routing work, and optional callable smoke still requires the configured production test authority.
