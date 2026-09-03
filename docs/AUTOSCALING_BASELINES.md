# URAI Jobs Autoscaling Baselines

## Objectives

- avoid worker starvation
- avoid runaway queue growth
- prevent OOM crashes
- preserve predictable latency
- isolate expensive workloads

## Narrator TTS workers

Recommended:

- concurrency: 1
- CPU: 2
- memory: 2-4Gi
- min instances: 1
- max instances: 20
- timeout: 900s

Alert triggers:

- lease timeout spikes
- queue backlog growth
- retry bursts
- saturation > 85%

## Spatial workers

Recommended:

- concurrency: 1
- memory-heavy profile
- GPU-ready deployment path
- max instances capped aggressively

## Asset workers

Recommended:

- concurrency: 2-4
- min instances: 0
- max instances: 10

## Studio orchestration

Recommended:

- low concurrency
- strong CPU guarantees
- strict request timeout ceilings
- deployment canary validation

## Saturation protection

Recommended defensive controls:

- queue depth alerts
- retry storm detection
- worker restart alarms
- dead-letter growth alarms
- regional failover runbook

## Rollback strategy

If smoke verification fails:

1. freeze deployment
2. redirect traffic to prior revision
3. rerun health verification
4. restore queues
5. replay DLQ jobs if needed
