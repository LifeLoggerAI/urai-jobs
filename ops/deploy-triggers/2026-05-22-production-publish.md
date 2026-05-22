# Production publish trigger

Triggered from ChatGPT GitHub connector to run the URAI Jobs production publish workflow after the inline fallback worker repair.

Commit requirements:

- Branch: main
- Workflow marker: [deploy-publish]
- Worker deploy: true for push-triggered publish
- Custom domain verification: non-blocking on push-triggered publish
- Production smoke: manual after PROD_SMOKE_ID_TOKEN is configured

Expected verification gates are defined in `.github/workflows/production-deploy-publish.yml`.
