# Marketplace Route Shell

Status: scaffolded

## Public routes

| Route | Purpose | State |
|---|---|---|
| `/` | Landing page | Placeholder |
| `/jobs` | Public jobs list | Placeholder |
| `/jobs/:slug` | Public job detail | Placeholder |
| `/apply/:jobId` | Candidate application flow | Placeholder |
| `/about` | Marketing/about | Placeholder |
| `/privacy` | Privacy policy | Placeholder |
| `/terms` | Terms of service | Placeholder |

## Candidate routes

| Route | Purpose | State |
|---|---|---|
| `/candidate/profile` | Candidate profile | Placeholder |
| `/candidate/applications` | Candidate application status | Placeholder |
| `/candidate/settings` | Candidate settings/export/delete | Placeholder |

## Employer routes

| Route | Purpose | State |
|---|---|---|
| `/employers` | Employer onboarding | Placeholder |
| `/employer/dashboard` | Employer dashboard | Placeholder |
| `/employer/jobs` | Employer jobs | Placeholder |
| `/employer/applications` | Employer applicants | Placeholder |

## Admin routes

| Route | Purpose | State |
|---|---|---|
| `/admin/review-queue` | Marketplace moderation queue | Placeholder |
| `/admin/jobs` | Marketplace job moderation | Placeholder |
| `/admin/employers` | Marketplace employer moderation | Placeholder |

## Route rule

Do not expose candidate, employer, or admin routes publicly without:

- auth checks
- role checks
- rules verification
- smoke verification
- release signoff
