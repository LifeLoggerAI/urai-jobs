import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

export function CreateJobPage() {
  const [tenantId, setTenantId] = useState('default')
  const [orgId, setOrgId] = useState('default')
  const [type, setType] = useState('generic.task')
  const [payload, setPayload] = useState('{}')
  const [jobId, setJobId] = useState('')
  const [output, setOutput] = useState('')

  async function createJob() {
    const call = httpsCallable(functions, 'createJob')
    const result = await call({
      tenantId,
      orgId,
      type,
      origin: 'API',
      priority: 'NORMAL',
      workerClass: 'FUNCTION',
      payload: JSON.parse(payload || '{}')
    })
    const data = result.data as { jobId: string }
    setJobId(data.jobId)
    setOutput(JSON.stringify(result.data, null, 2))
  }

  async function getStatus() {
    if (!jobId) return
    const call = httpsCallable(functions, 'getJobStatus')
    const result = await call({ jobId })
    setOutput(JSON.stringify(result.data, null, 2))
  }

  async function cancelJob() {
    if (!jobId) return
    const call = httpsCallable(functions, 'cancelJob')
    const result = await call({ jobId })
    setOutput(JSON.stringify(result.data, null, 2))
  }

  return (
    <div>
      <h1>URAI-JOBS</h1>
      <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="tenantId" />
      <input value={orgId} onChange={(e) => setOrgId(e.target.value)} placeholder="orgId" />
      <input value={type} onChange={(e) => setType(e.target.value)} placeholder="type" />
      <textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={10} cols={80} />
      <div>
        <button onClick={createJob}>Create job</button>
        <button onClick={getStatus}>Get status</button>
        <button onClick={cancelJob}>Cancel</button>
      </div>
      <input value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="jobId" />
      <pre>{output}</pre>
    </div>
  )
}
