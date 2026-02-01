'use client'

import { useEffect, useState } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getAuth } from 'firebase/auth'
import { firebaseApp } from '@/lib/firebase'
import { Job } from '@/../functions/src/types' // Adjust path based on your monorepo structure

const functions = getFunctions(firebaseApp)
const auth = getAuth(firebaseApp)

const listJobs = httpsCallable(functions, 'listJobs')
const createJob = httpsCallable(functions, 'createJob')

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [newJobName, setNewJobName] = useState("");
  const [newJobDescription, setNewJobDescription] = useState("");
  const [newJobHandler, setNewJobHandler] = useState("noop");

  useEffect(() => {
    listJobs().then(result => {
      setJobs(result.data as Job[]);
    });
  }, []);

  const handleCreateJob = () => {
    createJob({ name: newJobName, description: newJobDescription, handler: newJobHandler }).then(() => {
      setShowCreateJobModal(false);
      // Refresh the job list
      listJobs().then(result => {
        setJobs(result.data as Job[]);
      });
    });
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <div>
          <span className="mr-4">{auth.currentUser?.email}</span>
          <button onClick={() => auth.signOut()} className="text-blue-500">Sign Out</button>
        </div>
      </div>
      <button onClick={() => setShowCreateJobModal(true)} className="bg-blue-500 text-white px-4 py-2 rounded-md mb-4">Create Job</button>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Name</th>
              <th className="py-2 px-4 border-b">Handler</th>
              <th className="py-2 px-4 border-b">Status</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id}>
                <td className="py-2 px-4 border-b">{job.name}</td>
                <td className="py-2 px-4 border-b">{job.handler}</td>
                <td className="py-2 px-4 border-b">{job.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateJobModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Create a New Job</h3>
              <div className="mt-2 px-7 py-3">
                <input type="text" placeholder="Job Name" value={newJobName} onChange={e => setNewJobName(e.target.value)} className="w-full px-3 py-2 text-gray-700 bg-gray-200 rounded-md"/>
                <textarea placeholder="Job Description" value={newJobDescription} onChange={e => setNewJobDescription(e.target.value)} className="w-full mt-2 px-3 py-2 text-gray-700 bg-gray-200 rounded-md"/>
                <select value={newJobHandler} onChange={e => setNewJobHandler(e.target.value)} className="w-full mt-2 px-3 py-2 text-gray-700 bg-gray-200 rounded-md">
                  <option value="noop">noop</option>
                  <option value="assetFactoryRender">assetFactoryRender</option>
                  <option value="analyticsBackfill">analyticsBackfill</option>
                </select>
              </div>
              <div className="items-center px-4 py-3">
                <button onClick={handleCreateJob} className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  Create
                </button>
                <button onClick={() => setShowCreateJobModal(false)} className="mt-2 px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
