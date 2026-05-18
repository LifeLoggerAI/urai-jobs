#!/usr/bin/env node

console.log(JSON.stringify({
  severity: 'INFO',
  event: 'worker.heartbeat',
  worker: process.env.WORKER_NAME || 'unknown-worker',
  region: process.env.GCP_REGION || 'unknown',
  revision: process.env.K_REVISION || 'local',
  timestamp: new Date().toISOString(),
}));
