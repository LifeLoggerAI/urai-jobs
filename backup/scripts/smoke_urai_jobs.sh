#!/bin/bash

set -e

# Start emulators
firebase emulators:start --only firestore,functions,storage --import=./fixtures --export-on-exit & 
EMULATOR_PID=$!

sleep 10

# Run tests
API_KEY="your-secret-key"

# Enqueue job
JOB_ID=$(curl -s -X POST -H "Content-Type: application/json" -H "x-urai-internal-key: $API_KEY" -d '{"kind":"clip_demo","input":{}}' http://localhost:5001/urai-jobs/us-central1/enqueueJob | jq -r '.jobId')

if [ -z "$JOB_ID" ]; then
  echo "Failed to enqueue job"
  exit 1
fi

# Get job
curl -s -X GET -H "x-urai-internal-key: $API_KEY" http://localhost:5001/urai-jobs/us-central1/getJob/$JOB_ID

# Poll jobs
curl -s -X GET -H "x-urai-internal-key: $API_KEY" "http://localhost:5001/urai-jobs/us-central1/pollJobs?limit=5&kinds=clip_demo"

# Lock next job
LOCKED_JOB=$(curl -s -X POST -H "Content-Type: application/json" -H "x-urai-internal-key: $API_KEY" -d '{"workerId":"test-worker"}' http://localhost:5001/urai-jobs/us-central1/lockNextJob)

if [ -z "$LOCKED_JOB" ]; then
  echo "Failed to lock job"
  exit 1
fi

# Heartbeat
curl -s -X POST -H "Content-Type: application/json" -H "x-urai-internal-key: $API_KEY" -d '{"workerId":"test-worker"}' http://localhost:5001/urai-jobs/us-central1/heartbeat/$JOB_ID

# Release job
curl -s -X POST -H "Content-Type: application/json" -H "x-urai-internal-key: $API_KEY" -d '{"workerId":"test-worker"}' http://localhost:5001/urai-jobs/us-central1/release/$JOB_ID

# Cancel job
curl -s -X POST -H "x-urai-internal-key: $API_KEY" http://localhost:5001/urai-jobs/us-central1/cancelJob/$JOB_ID

# Retry job
curl -s -X POST -H "x-urai-internal-key: $API_KEY" http://localhost:5001/urai-jobs/us-central1/retryJob/$JOB_ID

# Kill emulators
kill $EMULATOR_PID
