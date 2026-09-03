# PDR-001: Autonomous URAI-Jobs V1-V5

Status: approved for separated implementation track
Date: 2026-06-04
Repository: LifeLoggerAI/urai-jobs

## Decision

URAI-Jobs will expand into a full autonomous career and economic navigation product across V1 through V5.

The existing repository remains the internal runtime and execution backbone. Public candidate, employer, marketplace, passport, and application surfaces must be implemented as a separated product module or companion app surface. They must not be mixed into the operator runtime UI or runtime-only functions without their own security, privacy, and release gates.

## Product definition

Autonomous URAI-Jobs helps users discover, score, prepare, track, and manage work opportunities. It is designed to match work to skills, schedule, work style, values, autonomy preference, communication style, growth direction, and long-term economic path.

## Boundary

This repo owns the runtime: queueing, worker execution, Firebase callable orchestration, Firestore job state, logs, retries, leases, reconciliation, Cloud Run dispatch, release evidence, production smoke, worker health, rollback, and operational launch gates.

The separated public product surface owns candidate onboarding, Career Mirror UI, public job discovery, candidate profiles, URAI Passport career identity, resume and portfolio storage, employer dashboards, applicant tracking, application rules, recruiter messaging, interview prep, offer comparison, pricing, billing, public pages, legal pages, and privacy pages.

## Trust rules

- No hidden applications, emails, recruiter messages, or employer data sharing.
- User approval or explicit user rules are required before any external action.
- Employers only receive user-approved profile packets.
- Private URAI behavioral data must not be shared directly with employers.
- Resume and profile outputs must not invent credentials, employers, degrees, compensation, references, or eligibility.
- Every autonomous action must be logged with actor, timestamp, source opportunity, generated artifact, consent rule, and cancel or rollback path.
- Users can pause, revoke, export, or delete career data.

## V1: Runtime plus Career Mirror foundation

Runtime gates:

- Production env precheck passes.
- Cloud Run worker URLs are real and reachable.
- Firebase functions, rules, indexes, storage rules, and hosting deploy cleanly.
- Domain verification passes for urai-jobs.web.app, uraijobs.com, and www.uraijobs.com.
- Production smoke passes.
- Worker health verification passes.
- Release evidence and rollback path are recorded.

Public product gates:

- Career Mirror shell exists.
- User work preference profile exists.
- Manual job discovery exists.
- Save, hide, and explain-match actions exist.
- Basic fit score exists with explainability.
- No external applications are sent in V1.

## V2: Marketplace plus application preparation

Required capabilities:

- Candidate profile.
- Employer profile.
- Public job list and job detail pages.
- Resume upload and storage rules.
- Resume parsing worker job.
- Portfolio and project extraction worker job.
- Cover letter and recruiter-message draft generation.
- Application packet builder.
- User approval before anything is sent.
- Privacy, legal, and App Check posture documented.

## V3: Bounded autonomous application agent

Required capabilities:

- User-defined application rule builder.
- Salary, location, remote or hybrid, industry, company blacklist, benefits, travel, work-hours, and employment-type filters.
- Scam and duplicate-posting detection.
- Application queue and execution ledger.
- Application artifact snapshots.
- Follow-up scheduler.
- Recruiter inbox triage.
- Kill switch and per-rule pause.

## V4: Interview, negotiation, and spatial career layer

Required capabilities:

- Interview prep room.
- Mock interview companion.
- Post-interview reflection capture.
- Offer comparison.
- Salary, benefits, bonus, and equity analysis.
- Team and work-style fit analysis.
- Burnout-risk forecast.
- Spatial opportunity portals.
- Golden path, shadow repeat, and future-self route visualizations.

## V5: Autonomous economic life-path agent

Required capabilities:

- Jobs, freelance, consulting, grants, accelerators, partnerships, licensing, creator income, and founder paths.
- URAI Passport career identity.
- Anonymous employer compatibility marketplace.
- Skill-gap engine.
- Auto-project recommendations.
- Long-term income path map.
- Founder, freelancer, employee, student, and rebuild modes.
- Consent-based external matching with revocable profile packets.

## Runtime job contracts to add

- career.profile.summarize
- career.fit.score
- career.resume.parse
- career.resume.tailor
- career.coverLetter.generate
- career.recruiterMessage.generate
- career.application.packet
- career.application.submit
- career.followup.schedule
- career.interview.prep
- career.offer.compare
- career.spatial.portal.generate
- career.passport.export

## Execution order

1. Finish Runtime V1 production launch evidence.
2. Add public product module boundary and architecture docs.
3. Add career job-type contracts to shared schema.
4. Implement V1 Career Mirror shell with no external application sending.
5. Add V2 resume, profile, and application-prep workers.
6. Add V3 consented action ledger and application rule engine.
7. Add V4 spatial, interview, and offer surfaces.
8. Add V5 Passport and economic opportunity graph.

## Acceptance rule

Do not call the full autonomous URAI-Jobs V1-V5 launch complete until every version gate has code, tests, staged or production verification, security evidence, privacy evidence, and user-facing documentation.
