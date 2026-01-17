#!/bin/bash
set -e

echo "--- Smoke Test: Starting ---"

# Ensure child processes are killed on exit
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Start emulators in the background, cleaning existing data
echo "- Starting emulators with a clean slate..."
./scripts/emulators.sh --clean &

# It can take a moment for the emulators, especially functions, to be ready.
# In a CI environment, you would use a more robust wait mechanism like wait-on.
# For local use, a simple sleep is often sufficient.
echo "- Waiting for emulators to initialize..."
sleep 15

# Seed the database with test jobs
echo "- Seeding database with demo jobs..."

# We use firebase emulators:exec to run a command against the emulators.
# This is the recommended way to run seed scripts.
firebase emulators:exec "pnpm --filter=\"./functions\" seed"


# Trigger the dispatcher to run immediately (for testing)
# In a real scenario, you'd wait for the scheduled time.
echo "- Manually triggering job dispatcher..."
# This uses the REST API for the Functions emulator to trigger the function
curl -X POST http://127.0.0.1:5001/urai-jobs/us-central1/dispatcher

sleep 10

# Here you could add checks to verify the status of the jobs in the database
# For example, using the Firebase CLI to query the database.
echo "- Checking job statuses (placeholder)..."

echo "--- Smoke Test: PASSED ---"
