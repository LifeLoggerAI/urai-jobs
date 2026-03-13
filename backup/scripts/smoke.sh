#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Start the Firebase emulator
firebase emulators:start --only functions,firestore,auth,storage --import=./firebase-export --export-on-exit & 
EMULATOR_PID=$!

# Wait for the emulator to start
sleep 10

# Run the seed script
# ts-node scripts/seed.ts

# Make a request to the health check endpoint
curl -f http://localhost:5001/urai-jobs/us-central1/health

# Kill the emulator
kill $EMULATOR_PID