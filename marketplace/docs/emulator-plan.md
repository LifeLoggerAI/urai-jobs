# Marketplace Emulator Plan

## Goals

- Verify marketplace auth boundaries
- Verify Firestore rules behavior
- Verify storage upload behavior
- Verify application workflow integrity
- Verify launch gating behavior

## Required Emulator Services

- Firebase Auth Emulator
- Firestore Emulator
- Storage Emulator
- Functions Emulator

## Required Verification Areas

### Candidate Flows
- sign in
- create profile
- upload resume intent
- apply to job
- duplicate apply rejection

### Employer Flows
- employer onboarding
- view applications
- permission enforcement

### Admin Flows
- moderation queue
- launch state verification
- deployment gating

## Required Runtime Checks

- environment validation
- JWT verification
- route registration
- signed upload validation
- Firestore persistence

## Production Blockers

Production deployment must remain blocked until emulator verification passes.
