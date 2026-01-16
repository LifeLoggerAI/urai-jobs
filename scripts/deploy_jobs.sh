#!/bin/bash
set -euo pipefail
set +H

# Build functions
(cd functions && pnpm build)

# Deploy to Firebase
firebase deploy --only functions,firestore:rules,firestore:indexes -P urai-jobs
