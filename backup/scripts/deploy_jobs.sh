#!/bin/bash

set -e

echo "Starting deployment process..."

# Run smoke tests
./scripts/jobs_smoke.sh

# Deploy to Firebase
echo "Deploying to Firebase..."
firebase deploy --only firestore,functions,hosting,storage --project urai-jobs

echo "LOG=URAI_JOBS_DEPLOY_OK"

echo "Deployment successful!"
