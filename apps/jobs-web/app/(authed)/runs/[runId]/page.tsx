'use client'

import { useEffect, useState } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { firebaseApp } from '@/lib/firebase'
import { JobRun } from '@/../functions/src/types'
import { useParams } from 'next/navigation'

const functions = getFunctions(firebaseApp)
const getRun = httpsCallable(functions, 'getRun')

export default function RunDetailPage() {
  const [run, setRun] = useState<JobRun | null>(null)
  const params = useParams()
  const runId = params.runId as string

  useEffect(() => {
    if (!runId) return;

    const fetchRun = () => {
      getRun({ id: runId }).then(result => {
        setRun(result.data as JobRun)
      })
    }

    fetchRun();

    const interval = setInterval(() => {
        if(run?.status === 'succeeded' || run?.status === 'failed') {
            clearInterval(interval);
            return;
        }
        fetchRun();
    }, 5000) // Poll every 5 seconds

    return () => clearInterval(interval)
  }, [runId, run?.status])

  if (!run) {
    return <div>Loading run details...</div>
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Run {run.id}</h1>
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="font-semibold">Status:</p>
            <p>{run.status}</p>
          </div>
          <div>
            <p className="font-semibold">Job ID:</p>
            <p>{run.jobId}</p>
          </div>
          <div>
            <p className="font-semibold">Queued At:</p>
            <p>{new Date((run.queuedAt as any)._seconds * 1000).toLocaleString()}</p>
          </div>
          {run.startedAt && (
            <div>
              <p className="font-semibold">Started At:</p>
              <p>{new Date((run.startedAt as any)._seconds * 1000).toLocaleString()}</p>
            </div>
          )}
          {run.finishedAt && (
            <div>
              <p className="font-semibold">Finished At:</p>
              <p>{new Date((run.finishedAt as any)._seconds * 1000).toLocaleString()}</p>
            </div>
          )}
        </div>
        {run.error && (
          <div className="mt-4">
            <p className="font-semibold text-red-500">Error:</p>
            <pre className="bg-gray-100 p-2 rounded">{JSON.stringify(run.error, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
