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
| `/candidate/applications` | Candidate application status | Isolated status/withdrawal client and view implemented; host and release acceptance open |
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

## Candidate applications host contract

The same isolated `mountCareerRoute` entry now handles `/candidate/applications`.
Its existing SDK-compatible session binding and same-origin API routing remain
host responsibilities. Load `applications-view.css` in that approved host.
No operator routes or provider/configuration/launch flags are changed.

The client reads owned application status from the existing authenticated API,
obtains available job titles through existing public published-job reads, and
withdraws only a previously loaded pending/reviewing application after the view's
explicit confirmation. Withdrawal success requires authoritative readback of the
same application/job/employer identity in `withdrawn` status. Conflicts, lost
acknowledgment and interrupted readback require reload rather than blind retry.
Stopping a wait does not imply that the server transaction was canceled.

No new `career.profile` or `career.application` consent receipt is manufactured.
The existing handlers enforce current account/tenant/consent authority. An owned
withdrawal remains possible after revocation; its minimal stop receipt is shown
without restoring candidate snapshots, answers or resume data. Auth denial and
account changes erase previous private rows. Unsupported status remains unknown;
a missing/closed job does not acquire an invented title or block an owned stop.

The existing API now provides fixed50-record pages through an owned, current
candidate/tenant cursor. Load more is manual and preserves already loaded pages;
reload starts a fresh first page. Withdrawal readback uses its originating page.
Only the selected verified stop receipt is updated; loaded membership/cursors
remain intact if a concurrent insertion shifts a page. Discover new records by
reloading rather than treating separate page reads as an all-current snapshot.
Missing/deleted cursors and changed/interrupted results require reload, with no
automatic retries or claim that multiple page reads form an atomic history.
The client has a shared20-second operation deadline across SDK, transport and
body reads; Stop waiting aborts client waits without claiming server cancellation.
Source interaction tests execute
actual compiled onRequest HTTP with explicitly owned Auth/Firestore/consent/DOM
fixtures. Real host, provider, rendered-browser and release acceptance stay open.
