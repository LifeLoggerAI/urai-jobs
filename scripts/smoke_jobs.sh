#!/bin/bash
set -euo pipefail
set +H

# Start emulators
firebase emulators:start --only firestore,functions &_pid=$!

# Enqueue test jobs
firebase functions:shell

# Wait for emulators to start
sleep 10

# Check job status
firebase firestore:get jobs/test-job

# Kill emulators
kill $_pid
