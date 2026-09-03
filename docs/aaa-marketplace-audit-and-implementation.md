# URAI Jobs AAA Marketplace Audit and Implementation Gate

Status: launch-blocking audit package
Date: 2026-05-19
Owner: URAI Jobs
Scope: `LifeLoggerAI/urai-jobs`

## Executive verdict

**Launch verdict for a public candidate/employer marketplace from this repository: NO.**

This repository is currently documented and structured as the **URAI Jobs Runtime**, an internal production job-execution fabric for queueing, leasing, running, retrying, monitoring, cancelling, and reconciling asynchronous work. It is not presently the public candidate/employer marketplace or public careers website.

That boundary is intentional and must not be blurred. A premium public marketplace can be implemented only as a clearly separated product surface or a separate app/module with its own routes, data model, APIs, rules, storage controls, QA, and release evidence.

## Critical rule

Do not mark any marketplace item complete because it is planned, mocked, visually implied, documented, or partially scaffolded. Completion requires working implementation, linked file paths, tests or smoke evidence, and a clear user-facing or admin-facing verification path. If evidence is missing, mark it incomplete.

Specs, prompts, README claims, and partial scaffolds are not evidence. Only code, tests, smoke output, screenshots, deployment logs, release records, rollback evidence, monitoring links, and signoffs count.

## Current known baseline to verify

- Backend/runtime job queue exists in this repository.
- Public marketplace product is not proven present in this repository.
- The repo README positions this repo as internal execution infrastructure, not the public marketplace.
- Marketplace work must remain launch-blocked until product, legal/privacy, accessibility, security, SEO, monitoring, rollback, smoke, and production evidence are complete.

## Target outcome

URAI Jobs should eventually feel like a premium spatial recruiting world where talent and employers enter a cinematic intelligence marketplace.

The final public product should feel:

- expensive
- futuristic
- sacred-tech
- cinematic
- calm but powerful
- deeply polished
- immersive
- spatial
- intelligent
- alive
- trustworthy
- fast
- accessible

It must not feel like generic SaaS, a stock job board, a template, a demo, a placeholder, or a Firebase scaffold.

## Repo boundary decision

Before implementation, choose one product path:

1. **Preferred:** keep `LifeLoggerAI/urai-jobs` as runtime infrastructure and implement public marketplace in a separate public app/repo or separate module.
2. **Acceptable only with approval:** add a clearly separated `marketplace/` module to this repo with independent app shell, functions, rules, storage paths, smoke tests, and release checklist.
3. **Blocked:** mixing public candidate/employer surfaces into existing runtime/operator code without a product decision and security review.

## Audit mission

A senior reviewer must inspect the entire repository and any proposed marketplace module:

- public frontend
- functions
- marketplace functions, if present
- Firestore rules
- Firestore indexes
- Storage rules
- Firebase Hosting config
- package scripts
- docs
- verification and signoff records
- release reports
- CI workflows
- environment templates
- production secret references

Produce a gap list grouped by:

- implemented
- partially implemented
- missing
- broken
- visually unacceptable
- technically risky
- launch-blocking
- polish-only but important

## Required product surfaces

The marketplace cannot launch until all of these are implemented, wired, tested, and visually polished:

| Surface | Required status |
|---|---|
| Cinematic landing page | Required |
| Job listings | Required |
| Search, filter, sort | Required |
| Job detail pages | Required |
| Featured / urgent / partner roles | Required or explicitly deferred |
| Candidate application flow | Required |
| Candidate lead capture | Required |
| Authenticated candidate profile | Required |
| Resume upload or resume intent | Required |
| Saved/bookmarked jobs | Required or explicitly deferred |
| Job alerts | Required or explicitly deferred |
| Employer landing | Required |
| Employer signup / organization creation | Required |
| Employer job posting | Required |
| Employer dashboard | Required |
| Application review flow | Required |
| Admin moderation dashboard | Required |
| Admin approve/reject/pause/feature/close actions | Required |
| Support/contact | Required |
| Privacy, terms, export, delete-request | Required |
| Pricing or employer plans | Required or explicitly deferred |
| Loading, error, empty, success, auth-required states | Required |
| Mobile experience | Required |
| Accessibility | Required |
| SEO and share previews | Required |

No route should feel like a placeholder, scaffold, demo, internal tool, generic template, or default Firebase static page.

## AAA visual and spatial bar

The public website must use a premium dark spatial environment with cinematic depth, mist, glow, parallax, dimensional layers, restrained moonlit/cosmic/intelligence-world visuals, high-quality typography, beautiful cards, polished filters, premium forms, elegant dashboards, refined shadows, blur, glass, gradients, lighting, and tasteful motion.

Every route must feel part of the same premium URAI world.

Reject:

- unreadable contrast
- cheap neon
- noisy particles
- clutter
- janky animation
- unstyled browser controls
- generic Tailwind starter-page feel
- low-quality placeholder imagery
- overanimated 3D that hurts usability
- mobile layout collapse

Prefer performant spatial effects using layered CSS, subtle WebGL-lite, parallax, depth, reflective panels, and restrained motion. Heavy 3D is allowed only if it stays fast, accessible, and stable.

## Content requirements

Every page must clearly answer:

- Where am I?
- What can I do here?
- Why does this matter?
- What happens next?
- Can I trust this?

The copy must explain:

- what URAI Jobs is
- who it is for
- why candidates should apply
- why employers or partners should post
- what makes URAI roles different
- how the marketplace works
- how privacy and candidate data are handled
- what happens after applying
- what employers get
- what URAI's talent network means
- support expectations
- legal and data rights context

Tone should be premium, visionary, clear, specific, and trustworthy. Avoid hype-only wording, vague recruiting language, fake compliance claims, and unsupported promises.

## Candidate UX audit

Verify the user can:

- discover jobs
- filter/search jobs
- open job detail pages
- understand role fit
- sign in when needed
- create/update profile
- upload or attach resume data
- apply successfully
- see application status
- withdraw or update notes if supported
- export/delete data where supported

## Employer UX audit

Verify the employer can:

- understand the employer offering
- sign in
- create an organization
- post a job
- see pending review state
- manage jobs
- review applications
- understand pricing/plans
- contact support

## Admin UX audit

Verify an admin can:

- sign in with admin claim
- see pending jobs/leads/reviews/metrics
- approve/reject/pause/feature/close jobs
- see audit trail
- verify non-admins cannot access admin data

## API and backend audit

If marketplace APIs are introduced, verify these routes or equivalents:

- `GET /api/health`
- `GET /api/marketplace/jobs`
- `POST /api/marketplace/jobs`
- `GET /api/marketplace/profiles`
- `POST /api/marketplace/profiles`
- `GET /api/marketplace/employers`
- `POST /api/marketplace/employers`
- `POST /api/marketplace/apply`
- `GET /api/marketplace/applications`
- `POST /api/marketplace/applications`
- `PUT /api/marketplace/applications`
- `POST /api/marketplace/resume-intent`
- `POST /api/marketplace/leads`
- `GET /api/marketplace/admin`
- `POST /api/marketplace/admin`
- bookmarks
- alerts
- export
- delete-request
- smoke endpoint

Check:

- auth enforcement
- admin claim enforcement
- employer membership enforcement
- candidate ownership enforcement
- rate limiting
- CORS
- App Check readiness
- Firestore rules parity with API assumptions
- Storage rules for resumes
- validation schemas
- audit logs
- error response consistency
- safe failure modes
- no exposed secrets
- no broad public writes
- no insecure direct object references
- no missing indexes
- no unbounded queries

## Legal, privacy, trust, and safety audit

Required before production:

- privacy policy route/page
- terms route/page
- data export flow
- deletion request flow
- candidate data handling explanation
- resume upload restrictions
- employer moderation policy
- support/contact path
- abuse/spam/rate-limit posture
- admin review workflow
- audit log posture
- cookie/analytics disclosure if analytics is enabled
- App Check rollout plan
- production secrets checklist
- no committed secrets
- no fake compliance claims

## SEO, share, and marketing audit

Every public page must have:

- unique title
- meta description
- canonical URL
- Open Graph title/description/image
- Twitter/social preview
- structured content hierarchy
- meaningful h1/h2/h3
- crawlable job content where appropriate
- sitemap/robots if applicable
- performance-safe assets
- descriptive URLs/slugs
- no placeholder metadata
- no broken social previews

## Performance and quality audit

Run and record evidence for every applicable command:

```bash
corepack enable
corepack prepare pnpm@8.15.9 --activate
pnpm install --frozen-lockfile
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
pnpm test
pnpm urai-jobs:smoke
```

If a marketplace package is added, it must also provide equivalent commands for:

```bash
npm run preflight
npm run smoke:static
npm run test:rules
npm run test:api
npm run release:verify
```

Also verify:

- Lighthouse-style performance/accessibility/SEO review where possible
- mobile viewport review
- keyboard navigation
- reduced motion
- slow network / empty data
- no console errors
- no hydration/runtime errors
- no broken asset paths
- no oversized assets
- no layout shift from hero/background/3D effects

## Release and deployment gate

Before production, verify:

- explicit Firebase project target
- no deploy collision with other URAI apps
- correct Firebase Hosting ownership
- required GitHub/Firebase secrets documented
- preview deploy works
- production deploy remains gated
- release record updated
- rollback SHA recorded
- rollback command recorded
- smoke targets recorded
- monitoring path documented
- admin/operator signoffs complete
- no pending signoffs remain
- production smoke checklist exists and passes

Do not deploy to production unless every release gate is satisfied.

## Required final report format

Any audit or implementation PR must start with:

1. **LAUNCH VERDICT:** YES / NO
2. **CONFIDENCE:** 0-100%
3. **MOST IMPORTANT BLOCKER**
4. **NEXT 5 ACTIONS TO GET TO PREVIEW**
5. **NEXT 5 ACTIONS TO GET TO PRODUCTION**

Do not bury the verdict in a long report.

## Product surface matrix

| Surface | Exists | Visually AAA | UX complete | Backend wired | Auth/rules safe | Tested | Launch-ready | Notes/blockers |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Landing | No evidence | No | No | No | No evidence | No | No | Public marketplace route not proven in repo |
| Listings | No evidence | No | No | No | No evidence | No | No | Missing or not proven |
| Search | No evidence | No | No | No | No evidence | No | No | Missing or not proven |
| Job detail | No evidence | No | No | No | No evidence | No | No | Missing or not proven |
| Apply | No evidence | No | No | No | No evidence | No | No | Missing or not proven |
| Candidate profile | No evidence | No | No | No | No evidence | No | No | Missing or not proven |
| Resume upload | No evidence | No | No | No | No evidence | No | No | Missing or not proven |
| Employer org | No evidence | No | No | No | No evidence | No | No | Missing or not proven |
| Employer post job | No evidence | No | No | No | No evidence | No | No | Missing or not proven |
| Employer dashboard | No evidence | No | No | No | No evidence | No | No | Missing or not proven |
| Admin dashboard | Runtime admin exists or may exist | Unknown | Unknown | Runtime only | Needs verification | Runtime tests only | No for marketplace | Marketplace moderation not proven |
| Support | No evidence | No | No | No | No evidence | No | No | Missing or not proven |
| Terms/privacy | No evidence | No | No | No | No evidence | No | No | Missing or not proven |
| Export/delete | No evidence | No | No | No | No evidence | No | No | Missing or not proven |
| SEO/OG | No evidence | No | No | No | N/A | No | No | Missing or not proven |
| Mobile | No evidence | No | No | N/A | N/A | No | No | Missing or not proven |
| Accessibility | No evidence | No | No | N/A | N/A | No | No | Missing or not proven |
| Loading/error/empty states | No evidence | No | No | Unknown | Unknown | No | No | Missing or not proven |

## Top blockers

1. Public marketplace product surface is not proven present in this repo.
2. Repo README positions this repository as internal runtime infrastructure.
3. Product decision is required before mixing marketplace into runtime.
4. Candidate flows are not proven implemented.
5. Employer flows are not proven implemented.
6. Marketplace admin moderation is not proven implemented.
7. Resume/data privacy flows are not proven implemented.
8. SEO/OG/social preview readiness is not proven implemented.
9. AAA spatial UI and UX are not proven implemented.
10. Marketplace preview/prod smoke and release evidence are not recorded.

## Next 5 actions to get to preview

1. Choose product path: separate public app/repo or separated `marketplace/` module.
2. Create the route map, data model, rules model, storage model, and smoke matrix.
3. Implement landing, listings, job detail, apply, employer, admin, terms/privacy, support, and data-rights surfaces.
4. Add preflight, rules, API, static smoke, visual QA, accessibility, and SEO checks.
5. Deploy preview and record screenshots, smoke output, rollback target, and signoffs.

## Next 5 actions to get to production

1. Complete legal/privacy, abuse/spam, App Check, rate-limit, and moderation review.
2. Complete candidate, employer, and admin flow QA on desktop and mobile.
3. Run production deploy prechecks and release verification commands.
4. Deploy production only after explicit signoffs and rollback target are recorded.
5. Run live smoke, record monitoring links, tag release, and close the launch gate.

## Implementation instruction for future agents

Be ruthless. Be specific. Fix what is weak. Block what is unsafe. Make it beautiful, credible, fast, complete, and production-verifiable.

Do not claim the marketplace is complete until the product exists, the UX works, the visuals meet the AAA bar, and release evidence is recorded.
