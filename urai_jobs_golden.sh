#!/bin/bash
set -e
echo "URAIM-JOBS GOLDEN PATH SETUP"
# Clean up existing clutter
rm -rf functions.bak.* .backup_* web.bak.* packages admin-app src tests tmp dataconnect extensions .github app .firebase .firebase-bin
# Standardize project structure
mkdir -p functions/src
mkdir -p scripts
# Stub out new files
touch functions/src/index.ts
touch scripts/dev.sh
touch scripts/test.sh
touch scripts/emulators.sh
touch scripts/deploy.sh
echo "Project cleaned and standardized."
