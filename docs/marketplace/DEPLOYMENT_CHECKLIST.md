# Marketplace Deployment Checklist

## Pre-deploy

- [ ] Runtime verification scripts pass.
- [ ] Typecheck passes.
- [ ] Build passes.
- [ ] Tests pass.
- [ ] Smoke checks pass.
- [ ] Emulator E2E passes.
- [ ] Firestore rules verified.
- [ ] Storage rules verified.
- [ ] No committed secrets.
- [ ] Required environment variables documented.
- [ ] Preview deployment verified.
- [ ] Rollback target recorded.

## Marketplace-specific preconditions

- [ ] Marketplace module exists separately from runtime operator app.
- [ ] Candidate collections created.
- [ ] Employer collections created.
- [ ] Admin moderation collections created.
- [ ] Resume storage paths verified.
- [ ] Candidate access rules verified.
- [ ] Employer-scoped rules verified.
- [ ] Admin-only moderation rules verified.
- [ ] CORS origins verified.
- [ ] App Check posture documented.
- [ ] Legal/privacy pages reviewed.
- [ ] SEO metadata reviewed.

## Preview deployment

- [ ] Preview URL loads.
- [ ] `/jobs` works.
- [ ] `/jobs/:slug` works.
- [ ] Apply flow works.
- [ ] Employer dashboard works.
- [ ] Admin moderation works.
- [ ] API health route works.

## Production deployment

- [ ] Apex domain verified.
- [ ] WWW domain verified.
- [ ] SSL valid.
- [ ] Production environment variables verified.
- [ ] Production smoke completed.
- [ ] Rollback command tested or documented.
- [ ] Release tag created.
- [ ] Release notes recorded.
