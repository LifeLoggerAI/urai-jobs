# URAI-JOBS

This project is a hiring + applicant tracking + waitlist + referrals system for URAI Labs / URAI.

## Golden Path Script

To ensure the project is in a clean, production-ready state, run the "golden path" script:

```bash
./scripts/urai_jobs_lock.sh
```

This script will:

- Install all dependencies
- Run linting and typechecking
- Build the application
- Run a smoke test against the Firebase emulators
- Deploy the application to Firebase

## Deployment

Deployment is handled by the `urai_jobs_lock.sh` script. To deploy the application, simply run the script.

## Environment Variables

There are no required environment variables for this project.
