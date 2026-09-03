# Marketplace Deployment Runtime

## Current Runtime State

The marketplace runtime remains launch-gated.

The current implementation contains:

- runtime scaffolding
- dispatcher scaffolding
- Firebase adapter scaffolding
- route contracts
- auth contracts
- repository contracts
- upload scaffolding
- CI verification scaffolding

## Required Before Staging Deployment

- Firebase Admin SDK integration
- JWT verification implementation
- Firestore CRUD implementation
- signed upload implementation
- emulator verification
- integration test execution
- staging environment validation

## Required Before Production Deployment

- launch approval signoff
- rollback verification
- deployment checklist verification
- QA matrix completion
- moderation verification
- security verification
- runtime smoke verification

## Deployment Sequence

1. run preflight
2. run security verification
3. run integration verification
4. run emulator verification
5. deploy to staging
6. verify runtime
7. verify launch state
8. complete signoff
9. deploy production

## Production Blockers

Production deployment must remain blocked until all runtime integrations are verified.
