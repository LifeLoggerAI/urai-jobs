# Marketplace QA Matrix

Status legend:
- NOT_STARTED
- IN_PROGRESS
- VERIFIED
- BLOCKED
- DEFERRED

| Area | Expected behavior | Verification method | Status | Owner/action |
|---|---|---|---|---|
| Public jobs list | Published jobs visible publicly | Manual + API smoke | NOT_STARTED | Marketplace module required |
| Job detail page | Slug route resolves correctly | Route + SEO verification | NOT_STARTED | Marketplace module required |
| Candidate auth | Google sign-in works | Emulator + production smoke | NOT_STARTED | Marketplace module required |
| Candidate profile | Candidate can create/update own profile | Firestore rules + UI test | NOT_STARTED | Marketplace module required |
| Resume upload | Signed upload intent works | Storage + rules verification | NOT_STARTED | Marketplace module required |
| Duplicate apply rejection | Same user cannot apply twice | API integration test | NOT_STARTED | Marketplace module required |
| Candidate application list | Candidate sees only own applications | Rules + API verification | NOT_STARTED | Marketplace module required |
| Candidate withdrawal | Candidate can withdraw pending application | API + UI verification | NOT_STARTED | Marketplace module required |
| Employer creation | Employer/org onboarding works | API + auth verification | NOT_STARTED | Marketplace module required |
| Employer job posting | Employer can create pending-review job | API + admin review verification | NOT_STARTED | Marketplace module required |
| Employer boundaries | Employer cannot access other employer data | Rules tests | NOT_STARTED | Marketplace module required |
| Admin moderation | Admin can approve/reject/pause/feature jobs | Emulator + UI verification | NOT_STARTED | Marketplace module required |
| Non-admin denial | Non-admin blocked from moderation routes | Rules + API verification | NOT_STARTED | Marketplace module required |
| Firestore deny-by-default | Unauthorized reads/writes denied | Rules tests | IN_PROGRESS | Runtime already partially verified |
| Runtime callable auth | Runtime functions enforce ownership/admin checks | Existing verification scripts | IN_PROGRESS | Existing runtime verification |
| Production smoke | Health endpoints and routes respond | Smoke checklist | NOT_STARTED | Deployment required |
| SSL/domain | Apex and www resolve correctly | External verification | NOT_STARTED | Domain verification required |
| Rollback | Previous release can be restored | Rollback drill | NOT_STARTED | Release ops required |
