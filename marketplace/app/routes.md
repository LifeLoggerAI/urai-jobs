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
| `/candidate/profile` | Candidate profile | Isolated editor/client implemented; host binding and release acceptance open |
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

## Candidate profile host contract

`index.mjs` exports `mountCareerRoute(root, bindings)` for the isolated
`/candidate/profile` route. Load `profile-editor.css` in the approved Career host.
The inactive Jobs operator routes remain inactive; this module does not mount in
the operator application or create another Firebase app/configuration.

The host must supply its real Firebase Auth instance and SDK `onIdTokenChanged`
through `firebaseProfileSession(auth, onIdTokenChanged)`, after Auth readiness.
The `consentAuthority({uid, purpose, signal})` binding must return the existing
purpose-specific `career.profile` receipt from legitimate privacy authority.
The editor's explicit checkbox is a user choice, not a fabricated receipt.
`reviewPrivacyChoices({uid, purpose})` must be supplied by the approved host to
open its actual privacy workflow. If absent, the control is disabled and states
that privacy choices are unavailable. The scaffolded `/candidate/settings` route
is not treated as an implemented privacy flow or linked as if it worked.
This source does not invent consent, mint tokens, solicit credentials or provide
a production binding. Canonical positive-grant authority remains separately open.

The existing same-origin `/api/marketplace/profiles/me` API must be routed by the
approved host. Client requests carry the current SDK-issued token, never a body
UID/tenant/role. Saves use the loaded revision and are followed by readback;
conflicts and interrupted readback require reload. Auth changes cancel previous
requests, erase previous profile/draft/consent UI and require a new scoped load.
The global server launch hold and resume-upload hold remain unchanged.

`marketplace/tests/lifecycle-scenarios.mjs` runs client persistence/readback and
mounted-editor interactions over the compiled v2 onRequest loopback endpoint.
Auth/Firestore/consent and DOM interfaces are explicitly synthetic; these tests
do not establish cloud, browser, physical-device or release acceptance.

Browser acceptance must still load this editor in the authorized isolated host,
create and refresh a profile, update it in two tabs to observe a conflict, reject
an unavailable/withdrawn receipt, switch accounts during a delayed request,
interrupt/reconnect after saving, confirm unsaved-change discard, and inspect
keyboard focus, screen-reader labels/status, 320px layout and 200% text scaling.
No standalone Auth/consent/bootstrap binding or public route release is implied.
