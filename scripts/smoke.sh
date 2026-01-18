#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Start emulators in the background
firebase emulators:start --only firestore,auth,functions,pubsub > /dev/null 2>&1 &
EMULATOR_PID=$!

# Trap exit signals to ensure emulators are shut down
trap 'kill $EMULATOR_PID' EXIT

# Wait for emulators to be ready
sleep 10

# Seed the database
npm run seed

# Run the integration test
npm --prefix functions test -- src/__tests__/integration.test.ts

# The EXIT trap will automatically kill the emulator process
