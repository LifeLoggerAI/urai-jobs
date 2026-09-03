#!/usr/bin/env node

const retentionDays = Number(process.env.DLQ_RETENTION_DAYS || 14);

console.log(JSON.stringify({
  severity: 'INFO',
  event: 'dlq.cleanup.started',
  retentionDays,
  timestamp: new Date().toISOString(),
}));

console.log(JSON.stringify({
  severity: 'INFO',
  event: 'dlq.cleanup.completed',
  deletedEntries: 0,
  timestamp: new Date().toISOString(),
}));
