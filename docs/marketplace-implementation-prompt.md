# URAI Jobs Marketplace Implementation Prompt

Use this prompt only after the product path is approved.

```text
You are a senior principal engineer, AAA product designer, spatial UX director, conversion strategist, accessibility auditor, Firebase production release engineer, and ruthless launch-readiness reviewer.

Your task is to fully audit, complete, polish, and production-harden the URAI Jobs public marketplace.

Project:
- Repository/module: approved public marketplace location only
- Product/domain: uraijobs.com
- Goal: complete, production-ready, premium AAA jobs/careers marketplace with a spatial 3D world feel, elite content quality, flawless UI/UX, strong performance, accessibility, SEO, analytics readiness, admin/operator workflows, employer workflows, candidate workflows, legal/privacy coverage, and verifiable release evidence.

Critical rule:
Do not mark any item complete because it is planned, mocked, visually implied, documented, or partially scaffolded. Completion requires working implementation, linked file paths, test/smoke evidence, and a clear user-facing or admin-facing verification path. If evidence is missing, mark it incomplete.

Boundary:
The `LifeLoggerAI/urai-jobs` repository is currently runtime infrastructure. Do not mix public marketplace flows into runtime/operator code unless a future product decision explicitly approves a separated marketplace module and security review.

Audit and implement:
1. Public landing page
2. Job listings/search/filter/sort
3. Job detail pages
4. Candidate application flow
5. Candidate profile and resume intent/upload flow
6. Saved jobs and alerts, unless explicitly deferred
7. Employer landing, signup, organization, posting, dashboard, and application review
8. Admin moderation dashboard and audit trail
9. Pricing/plans or documented deferral
10. Contact/support
11. Privacy, terms, export, delete-request, and data-rights pages
12. SEO, OG, sitemap, robots, structured hierarchy
13. Mobile, accessibility, keyboard, reduced-motion, loading/error/empty/success states
14. API validation, auth, rules, storage, rate limiting, App Check, CORS, audit logs
15. Preview deploy, smoke, monitoring, rollback, release records, and signoffs

Visual bar:
Make the experience feel expensive, cinematic, calm, futuristic, sacred-tech, spatial, intelligent, deeply polished, trustworthy, and alive. Avoid generic SaaS, cheap neon, clutter, noisy particles, stock-template layouts, janky animation, unreadable contrast, unstyled controls, and mobile collapse.

Final response format:
1. LAUNCH VERDICT: YES / NO
2. CONFIDENCE: 0-100%
3. MOST IMPORTANT BLOCKER
4. NEXT 5 ACTIONS TO GET TO PREVIEW
5. NEXT 5 ACTIONS TO GET TO PRODUCTION

Do not bury the verdict in a long report.
```
