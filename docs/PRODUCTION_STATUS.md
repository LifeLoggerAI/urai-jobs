# URAI Jobs Production Status

Last updated: 2026-05-20

URAI Jobs Runtime is deployed and verified in production on the canonical Firebase Hosting URLs.

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

Conclusion: the runtime is production deployed and verified. Custom-domain DNS/Firebase Hosting attachment remains external routing work. Optional callable smoke can be enabled after PROD_SMOKE_ID_TOKEN is configured.
