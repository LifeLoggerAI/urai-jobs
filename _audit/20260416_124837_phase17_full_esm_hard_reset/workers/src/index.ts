import express from 'express'
import admin from 'firebase-admin'
import { ulid } from 'ulid'
import type { JobDoc, JobResultDoc, ResultEnvelope } from '../../types/index.js.js.js'

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()
const app = express()
app.use(express.json())

const PORT = Number(process.env.PORT || 8080)
const TOKEN = process.env.URAI_JOBS_WORKER_TOKEN || ''

function isoNow() {
  return new Date().toISOString()
}

function requireWorkerAuth(req: express.Request, res: express.Response): boolean {
  if (!TOKEN) return true
  const header = req.headers.authorization || ''
  if (header !== `Bearer ${TOKEN}`) {
    res.status(401).json({ ok: false, error: 'unauthorized' })
    return false
  }
  return true
}

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'urai-jobs-worker' })
})

app.post('/execute', async (req: any, res: any) => {
  try {
    if (!requireWorkerAuth(req, res)) return
    const jobId = String(req.body?.jobId || '')
    const leaseToken = String(req.body?.leaseToken || '')
    if (!jobId || !leaseToken) {
      res.status(400).json({ ok: false, error: 'missing jobId or leaseToken' })
      return
    }

    const jobRef = db.collection('jobs').doc(jobId)
    const queueRef = db.collection('jobQueue').doc(jobId)

    const [jobSnap, queueSnap] = await Promise.all([jobRef.get(), queueRef.get()])
    if (!jobSnap.exists || !queueSnap.exists) {
      res.status(404).json({ ok: false, error: 'job not found' })
      return
    }

    const job = jobSnap.data() as JobDoc
    const queue = queueSnap.data() as { lease?: { leaseToken?: string | null } }

    if (queue.lease?.leaseToken !== leaseToken) {
      res.status(409).json({ ok: false, error: 'lease mismatch' })
      return
    }

    await jobRef.set({
      status: 'RUNNING',
      updatedAt: isoNow(),
      startedAt: job.startedAt || isoNow(),
      progress: { percent: 25, stage: 'CLOUD_RUN', message: 'Worker accepted job' },
      lease: {
        ...job.lease,
        heartbeatAt: isoNow()
      }
    }, { merge: true })

    const output = {
      handledBy: 'cloud-run-worker',
      receiptId: ulid(),
      type: job.type,
      payloadEcho: job.payload
    }

    const envelope: ResultEnvelope = {
      ok: true,
      status: 'SUCCESS',
      code: 'OK',
      reason: 'Cloud Run worker completed',
      finishedAt: isoNow(),
      attemptCount: job.attemptCount,
      artifactRefs: [],
      meta: output
    }

    const resultDoc: JobResultDoc = {
      jobId,
      tenantId: job.tenantId,
      orgId: job.orgId,
      status: 'SUCCESS',
      envelope,
      artifacts: [],
      output,
      createdAt: isoNow(),
      updatedAt: isoNow()
    }

    await db.collection('jobResults').doc(jobId).set(resultDoc, { merge: true })
    await jobRef.set({
      status: 'SUCCESS',
      resultEnvelope: envelope,
      updatedAt: isoNow(),
      finishedAt: isoNow(),
      progress: { percent: 100, stage: 'SUCCESS', message: 'Worker completed job' }
    }, { merge: true })

    await queueRef.set({
      status: 'DONE',
      updatedAt: isoNow()
    }, { merge: true })

    await db.collection('logs').doc(ulid()).set({
      logId: ulid(),
      jobId,
      tenantId: job.tenantId,
      orgId: job.orgId,
      level: 'INFO',
      message: 'Cloud Run worker completed job',
      context: output,
      createdAt: isoNow()
    })

    res.json({ ok: true, jobId, status: 'SUCCESS' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
})

app.listen(PORT, () => {
  console.log(`urai-jobs-worker listening on ${PORT}`)
})
