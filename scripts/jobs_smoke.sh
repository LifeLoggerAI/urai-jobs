#!/bin/bash

set -e

echo "Running smoke tests..."

npx pnpm install
npx pnpm build

firebase emulators:start --only auth,firestore,functions,storage &
EMULATOR_PID=$!

# Wait for emulators to start
sleep 10

npx pnpm test:ci
npx pnpm e2e

curl -f http://localhost:5001/urai-jobs/us-central1/health

kill $EMULATOR_PID

echo "Smoke tests passed!"
