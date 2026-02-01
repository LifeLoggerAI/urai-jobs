'use client'

import { useEffect, useState } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { firebaseApp } from '@/lib/firebase'
import { Job, JobRun } from '@/../functions/src/types'
import { useParams, useRouter } from 'next/navigation'

const functions = getFunctions(firebaseApp)

const getJob = httpsCallable(functions, 'getJob')
const listRuns = httpsCallable(functions, 'listRuns')
const enqueueRun = httpsCallable(functions, 'enqueueRun')

export default function JobDetailPage() {
  const [job, setJob] = useState<Job | null>(null)
  const [runs, setRuns] = useState<JobRun[] | null>(null)
  const params = useParams()
  const router = useRouter()
  const jobId = params.jobId as string

  useEffect(() => {
    if (jobId) {
      getJob({ id: jobId }).then(result => {
        setJob(result.data as Job)
      })
      listRuns({ jobId }).then(result => {
        setRuns(result.data as JobRun[])
      })
    }
  }, [jobId])

  const handleRunNow = () => {
    enqueueRun({ jobId }).then(result => {
      // Navigate to the run details page
      const { runId } = result.data as { runId: string };
      router.push(`/runs/${runId}`)
    })
  }

  if (!job) {
    return <div>Loading job details...</div>
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{job.name}</h1>
      <p className="mb-4">{job.description}</p>
      <button onClick={handleRunNow} className="bg-blue-500 text-white px-4 py-2 rounded-md mb-4">Run Now</button>

      <h2 className="text-xl font-bold mt-8 mb-4">Job Runs</h2>
      {runs ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b">Run ID</th>
                <th className="py-2 px-4 border-b">Status</th>
                <th className="py-2 px-4 border-b">Queued At</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr key={run.id} onClick={() => router.push(`/runs/${run.id}`)} className="cursor-pointer hover:bg-gray-100">
                  <td className="py-2 px-4 border-b">{run.id}</td>
                  <td className="py-2 px-4 border-b">{run.status}</td>
                  <td className="py-2 px-4 border-b">{new Date((run.queuedAt as any)._seconds * 1000).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>Loading runs...</div>
      )}
    </div>
  )
}
