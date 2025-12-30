# URAI-JOBS: The Execution, Billing, and Accountability Backbone of UrAi

`urai-jobs` is the execution engine and system of record for UrAi. It is a Firebase + Google Cloud job orchestration system whose purpose is to run all background and AI work, track exactly what happened, handle failures and retries safely, and allow safe human control when automation fails. If something in UrAi did not run through `urai-jobs`, then for the system, it did not happen. That rule is intentional.

## Why You Built It

Most apps handle background work poorly:

- tasks fail silently
- retries happen invisibly
- history gets overwritten
- costs are unclear
- systems break as they scale

`urai-jobs` exists to prevent all of that.

It turns UrAi into real infrastructure, not just an app.

## The Core Principle

Everything in `urai-jobs` follows one rule:

> Jobs define intent.
> Job runs record reality.
> Humans never edit reality — they create new intent.

This makes the system honest, auditable, and scalable.

## The Two Main Concepts

### 1. Jobs (Intent)

Jobs are stable definitions of work:

- AI generation
- data processing
- delivery
- cleanup
- notifications
- reviews

Jobs define retries, limits, and pause rules. They change rarely.

### 2. Job Runs (Reality)

Every execution attempt creates a job run.

Each run has a real state:

- `queued`
- `running`
- `succeeded`
- `failed`
- `deadlettered`
- `cancelled`

Runs are immutable history. Retries create new runs, never edits.

## What Firebase & Google Cloud Do

Inside Firebase Studio, `urai-jobs` uses:

- **Firestore** → source of truth (jobs, runs, requests, results)
- **Cloud Functions v2** → workers that execute jobs
- **Cloud Tasks** → durable queue with retries & rate limits
- **Secret Manager** → API keys & credentials
- **Logging & Monitoring** → visibility and alerts
- **Firebase Hosting** → admin/operator dashboard
- **BigQuery (US)** → analytics, costs, audits, errors, usage (19 languages)

Firestore defines reality. Everything reacts to it.

## How It Works With the UrAi App

1.  A user does something in UrAi
2.  UrAi requests a job from `urai-jobs`
3.  A job run is created (`queued`)
4.  A worker executes it (`running`)
5.  Success or failure is recorded forever
6.  Humans can retry or cancel safely

UrAi asks. `urai-jobs` executes and records.

## Human Control (Safely Designed)

Humans can:

- retry failed jobs
- cancel running jobs
- pause job types
- pause the whole system
- inspect failures and costs

Humans cannot:

- fake success
- edit execution history
- bypass the system

Every action is logged.

## What Makes It Valuable

Because it turns UrAi into real infrastructure:

- no silent failures
- no fake success
- clear costs
- full audit trail
- safe scaling

## One-Sentence Summary

`urai-jobs` is the Firebase Studio project that runs and records all of UrAi’s background and AI work — ensuring reliability, visibility, cost tracking, and safe human control without ever lying about what happened.
Paul — best is **Application Default Credentials (ADC)**. No key files, no leaking secrets, works cleanly for dev.

## Do this (local dev, safest)

### 1) Log in once

```bash
gcloud auth application-default login
```

### 2) Make sure your seed script uses ADC

Edit `seed.js` to initialize Admin like this:

```js
// seed.js
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

// If you seed Firestore:
const db = admin.firestore();

// ...your seeding logic...
```

### 3) Run the seed

```bash
export GOOGLE_CLOUD_PROJECT="urai-4dc1d"   # your Firebase project id
node seed.js
```

That’s it.

---

## If you’re seeding the emulator (recommended for testing)

Start the emulator, then run:

```bash
export FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
export GOOGLE_CLOUD_PROJECT="urai-4dc1d"
node seed.js
```

(Using ADC here is fine; emulator ignores auth.)

---

## Hard rule: never keep serviceAccount.json in the repo

Add to `.gitignore` now (even if you’re not using it):

```
serviceAccount.json
**/serviceAccount.json
*.pem
*.key
```

---

If your current `seed.js` is written to *require* `serviceAccount.json`, paste the top ~30 lines of it and I’ll rewrite it to ADC in one clean copy-paste block.
