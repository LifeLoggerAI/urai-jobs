import express from 'express'

const app = express()
app.use(express.json())

const PORT = Number(process.env.PORT || 8080)
const TOKEN = process.env.URAI_JOBS_WORKER_TOKEN || ''

function requireWorkerAuth(req: express.Request, res: express.Response): boolean {
  if (!TOKEN) {
    res.status(503).json({
      ok: false,
      service: 'urai-jobs-worker',
      code: 'WORKER_AUTH_NOT_CONFIGURED',
      error: 'worker auth token is not configured; execution disabled'
    })
    return false
  }

  const header = req.headers.authorization || ''
  if (header !== `Bearer ${TOKEN}`) {
    res.status(401).json({ ok: false, service: 'urai-jobs-worker', code: 'UNAUTHORIZED_WORKER_REQUEST', error: 'unauthorized' })
    return false
  }

  return true
}

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'urai-jobs-worker', executionReady: Boolean(TOKEN), implemented: false })
})

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'urai-jobs-worker', executionReady: Boolean(TOKEN), implemented: false })
})

app.post('/execute', async (req: express.Request, res: express.Response) => {
  if (!requireWorkerAuth(req, res)) return
  const jobId = String(req.body?.jobId || req.body?.id || 'unknown-job')
  const jobType = String(req.body?.type || req.body?.jobType || 'unknown-job-type')
  res.status(501).json({
    ok: false,
    service: 'urai-jobs-worker',
    jobId,
    jobType,
    status: 'NOT_IMPLEMENTED',
    code: 'NOT_IMPLEMENTED',
    error: 'generic worker execution is gated until a real worker implementation and lifecycle proof exist'
  })
})

app.post('/execute-job', async (req: express.Request, res: express.Response) => {
  if (!requireWorkerAuth(req, res)) return
  const jobId = String(req.body?.jobId || req.body?.id || 'unknown-job')
  const jobType = String(req.body?.type || req.body?.jobType || 'unknown-job-type')
  res.status(501).json({
    ok: false,
    service: 'urai-jobs-worker',
    jobId,
    jobType,
    status: 'NOT_IMPLEMENTED',
    code: 'NOT_IMPLEMENTED',
    error: 'generic worker execution is gated until a real worker implementation and lifecycle proof exist'
  })
})

app.listen(PORT, () => {
  console.log(JSON.stringify({ event: 'worker.started', service: 'urai-jobs-worker', port: PORT, executionReady: Boolean(TOKEN), implemented: false }))
})
