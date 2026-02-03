#!/bin/bash

# Exit on first error
set -e

# Start emulators
firebase emulators:start --only functions,firestore & 
emulator_pid=$!

sleep 10

# Enqueue a job
jobId=$(curl -s -X POST -H "Content-Type: application/json" -H "x-urai-internal-key: your-secret-key" -d '{"kind":"clip_demo","input":{"url":"https://example.com/video.mp4"}}' http://localhost:5001/urai-jobs/us-central1/api/jobs/enqueue | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf-8")).jobId')

echo "Enqueued job with ID: $jobId"

# Poll for the job
curl -s -H "x-urai-internal-key: your-secret-key" "http://localhost:5001/urai-jobs/us-central1/api/jobs/poll?limit=1&kinds=clip_demo" | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf-8")).jobs[0].jobId' | grep $jobId

echo "Polled and found job"

# Lock the job
curl -s -X POST -H "Content-Type: application/json" -H "x-urai-internal-key: your-secret-key" -d '{"workerId":"test-worker","leaseMs":60000}' http://localhost:5001/urai-jobs/us-central1/api/jobs/$jobId/lock | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf-8")).job.status' | grep "RUNNING"

echo "Locked job"

# Heartbeat the job
curl -s -X POST -H "Content-Type: application/json" -H "x-urai-internal-key: your-secret-key" -d '{"workerId":"test-worker","leaseMs":60000}' http://localhost:5001/urai-jobs/us-central1/api/jobs/$jobId/heartbeat | grep '"ok":true'

echo "Heartbeated job"

# Mark job as success
curl -s -X POST -H "Content-Type: application/json" -H "x-urai-internal-key: your-secret-key" -d '{"status":"SUCCEEDED"}' http://localhost:5001/urai-jobs/us-central1/api/jobs/$jobId/release


echo "SUCCESS: Smoke test passed"

kill $emulator_pid
