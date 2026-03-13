You are the senior engineer + QA lead for the Firebase Studio project **urai-jobs**.

WE ARE NOT USING APP HOSTING.
We are using **Firebase Hosting (static SPA)** with:
- hosting.public = "public"
- rewrites "**" -> "/index.html"
And Cloud Functions in "functions" (Node 20) + Firestore + Storage + Emulators.

GOAL
Fully complete, harden, and polish URAI-Jobs into a production-ready hiring + applicant tracking + waitlist + referrals system for URAI Labs / URAI. This project must build, run locally with emulators, and deploy cleanly. Do not leave TODOs. If something is missing, create it. If something is partially done, finish it. If something is broken, fix it.

ABSOLUTE CONSTRAINTS
- Keep Hosting SPA architecture (single index.html). Build output must land in `/public`.
- Use TypeScript for Functions and any app code you add.
- Zero TypeScript errors. Zero lint errors.
- Include seed scripts + demo dataset generator.
- Include a protected admin console with Firestore-based admin allowlist.
- Security Rules must be strict: public reads only for `jobPublic`, and public writes only for applicant/applications/waitlist/events (validated).
- Storage: resumes are private; only admins can read them; applicants can upload only to their own scoped path using a token flow.

STEP 0 — INVENTORY + AUDIT (DO THIS FIRST)
1) Print a repo inventory:
   - Is there an existing frontend build system? (Vite/React/Vue/Vanilla)
   - What exists in /public today?
   - What exists in /functions/src today?
   - Existing rules/indexes files content
   - Existing collections already used (if any)
2) Identify gaps vs TARGET SYSTEM below, then implement everything.

TARGET SYSTEM

A) FRONTEND SPA (HOSTED IN /public)
Implement a minimal but complete SPA using a standard build tool:
- If frontend already exists, finish it.
- If not, create **Vite + React + TypeScript** in a `/web` folder, then build into `/public`.

Routes (client-side):
- /jobs (job board list)
- /jobs/:jobId (job detail + Apply CTA)
- /apply/:jobId (apply form)
- /apply/success
- /waitlist
- /ref/:code (referral landing + apply redirect)
- /admin (protected)

UX requirements:
- Mobile-first, fast, clean.
- Autosave application draft locally (localStorage) keyed by jobId+email.
- Resume upload (PDF/DOC/DOCX) with size limit.
- Accessibility: labels, focus states, keyboard navigation.

Tracking:
- Write basic event docs to Firestore `events`:
  - page_view, apply_start, apply_submit, waitlist_submit, referral_click
- Keep it internal; do not require GA4.

Auth:
- For admin console: use Firebase Auth (Google provider by default) + check `admins/{uid}` doc existence.

B) ADMIN CONSOLE (PROTECTED)
Under /admin:
- Job CRUD: draft/open/paused/closed
- View applicants per job with filters (status, tag)
- Applicant/Application detail: status changes, internal notes, tags
- Export CSV per job (client-side export ok)
- Simple metrics:
  - applicants per job
  - funnel counts by status
  - average time from submit → first review (if timestamps exist)

C) FIRESTORE DATA MODEL (IMPLEMENT)
Collections:

1) jobs/{jobId}
- title, department, locationType ("remote"|"hybrid"|"onsite"), locationText
- employmentType ("full_time"|"part_time"|"contract"|"intern")
- descriptionMarkdown
- requirements: string[]
- niceToHave: string[]
- compensationRange: { min?: number, max?: number, currency?: string } optional
- status: "draft"|"open"|"paused"|"closed"
- createdAt, updatedAt (server timestamps)
- createdBy (uid)

2) jobPublic/{jobId}
- public projection for read-only job board
- only includes fields safe for public display
- exists only when status="open"

3) applicants/{applicantId}
- primaryEmail (lowercased)
- name
- phone optional
- links: { portfolio?: string, linkedin?: string, github?: string, other?: string[] }
- source: { type: "direct"|"referral"|"waitlist", refCode?: string, campaign?: string }
- createdAt, updatedAt, lastActivityAt

4) applications/{applicationId}
- jobId, applicantId
- applicantEmail (lowercased) (denormalized for lookups)
- status: "NEW"|"SCREEN"|"INTERVIEW"|"OFFER"|"HIRED"|"REJECTED"
- answers: map (q->a) with known keys
- resume: { storagePath: string, filename: string, contentType: string, size: number } optional
- tags: string[]
- notesCount: number
- submittedAt, updatedAt
- internal: { rating?: number, reviewerId?: string, reviewedAt?: timestamp }

5) referrals/{refCode}
- code, createdBy, createdAt
- clicksCount, submitsCount
- active boolean

6) waitlist/{id}
- email (lowercased), name optional, interests: string[]
- consent: { terms: boolean, marketing: boolean }
- createdAt

7) admins/{uid}
- role: "owner"|"admin"|"reviewer"
- createdAt

8) events/{eventId}
- type: string
- entityType: "job"|"applicant"|"application"|"referral"|"waitlist"|"page"
- entityId: string
- metadata: map
- createdAt

D) SECURITY RULES (firestore.rules MUST BE COMPLETE)
Rules must enforce:
- Public read: ONLY `jobPublic/*` and ONLY if doc exists.
- Public write allowed ONLY for:
  - applicants: create (validated), no read
  - applications: create (validated), no read
  - waitlist: create (validated), no read
  - events: create (validated), no read
- Admin-only:
  - CRUD jobs
  - read/update applicants/applications/waitlist/referrals/events as needed
  - update application statuses, tags, internal fields
- Absolutely prevent writing to `admins/*` by non-admins.
- Field validation:
  - enums for statuses
  - required fields present
  - max lengths for strings
  - arrays size bounded
  - emails lowercased
- Include helper functions in rules: isSignedIn(), isAdmin(), hasOnly(keys), etc.

E) STORAGE RULES (storage.rules MUST BE COMPLETE)
Resumes must be private.
- Store resumes at: `resumes/{applicantId}/{applicationId}/{filename}`
- Only admins can read/download.
- Upload flow:
  - The applicant uploads using a **callable function** that returns:
    - (option A) a signed upload URL, OR
    - (option B) a short-lived upload token stored in Firestore and required as metadata
Choose the approach that is simplest and works well with Firebase Web SDK; implement it fully.

Constraints:
- Allowed content types: PDF, DOC, DOCX
- Max size (e.g., 10MB)
- Deny all other storage paths by default.

F) CLOUD FUNCTIONS (functions/src, Node 20, TS)
Implement:

1) onJobWrite (firestore trigger)
- Maintain `jobPublic/{jobId}` projection:
  - if status == "open" => write/update jobPublic
  - else => delete jobPublic

2) onApplicationCreate (firestore trigger)
- Create/merge applicant:
  - If applicantId already provided, update lastActivityAt
  - Else find applicant by primaryEmail (use a deterministic applicantId like hash(email) OR store a lookup doc)
- Write `events` entry: "application_submitted"
- Increment job rollup (store in `jobs/{jobId}.stats` or separate `jobStats/{jobId}`):
  - applicantsCount
  - statusCounts
- If referral refCode exists, increment referrals.submitsCount

3) createResumeUpload (callable)
- Input: { applicantId, applicationId, filename, contentType, size }
- Validate size/type.
- Verify caller identity or use a "submission secret" stored on the application (safer: require auth for applicants, or accept unauth but verify via an application-specific token)
- Return upload instructions:
  - either signed URL, or upload token + path
- Ensure security rules align with your chosen approach.

4) adminSetApplicationStatus (callable, admin-only)
- Input: { applicationId, status, tags?, rating? }
- Update status + internal fields + timestamps
- Write an `events` entry: "status_changed"

5) scheduledDailyDigest (scheduler)
- Create a Firestore doc `digests/{YYYY-MM-DD}` summarizing:
  - new applications last 24h
  - pending NEW/SCREEN counts
  - top jobs by applicant count
- If email is configured, also email admins; otherwise Firestore-only is fine.

6) httpHealth (http function)
- GET /health returns 200 ok + build info (for sanity).

G) INDEXES (firestore.indexes.json)
Create composite indexes for:
- applications: where jobId == ? orderBy submittedAt desc
- applications: where jobId == ? where status == ? orderBy submittedAt desc
- applications: where status == ? orderBy submittedAt desc
- jobs: where status == ? orderBy updatedAt desc
- events: where entityType == ? where entityId == ? orderBy createdAt desc
- referrals: where active == ? orderBy createdAt desc (if used)
Add any additional indexes required by implemented queries.

H) FRONTEND BUILD PIPELINE
Because Hosting serves `/public`, do this:
- Create `/web` (Vite + React + TS)
- Configure `web/vite.config.ts` to build output into `../public` and emptyOutDir true.
- Add root `package.json` scripts:
  - "dev": run web dev server + emulators (concurrently)
  - "build": build web into public + build functions
  - "emulators": firebase emulators:start
- Make sure `firebase deploy` deploys Hosting+Functions cleanly.

I) SEED + DEMO MODE
Add:
- `scripts/seed.ts` (or `web/scripts/seed.ts`) that writes:
  - 5 jobs (mix of open/draft)
  - 30 applicants
  - 40 applications
  - 5 referral codes
  - 20 waitlist entries
- `npm run seed` that runs against emulators by default.
- Include README steps.

J) QA + TESTS
- Add Firestore rules tests using firebase emulator testing library:
  - public can read jobPublic
  - public cannot read applicants/applications
  - admin can read/update
  - public can create application with valid schema only
- Add at least one test for status transition callable requiring admin.

K) README (DEPLOY READY)
Write a README with:
- local setup
- run emulators
- seed
- run web dev
- deploy steps
- required env/config (if any)

EXECUTION REQUIREMENTS
1) Implement everything above.
2) Output a final checklist with:
   - files created/modified
   - commands to run locally
   - commands to deploy
3) Do not ask me questions.
4) If something is ambiguous, choose the safest standard option and document it.

IMPORTANT FIX
The current firebase.json has predeploy with quotes that can break JSON:
`"npm --prefix "$RESOURCE_DIR" run lint"`
Replace it with a valid JSON string using escaped quotes:
`"npm --prefix \"$RESOURCE_DIR\" run lint"`
OR simpler:
`"npm --prefix $RESOURCE_DIR run lint"`
Fix that in firebase.json.

Now implement.