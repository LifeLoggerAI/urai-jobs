import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import CreateJobForm from './CreateJobForm';
import JobAdminView from './JobAdminView';

interface Job {
  id: string;
  title: string;
  status: string;
  createdAt: any;
}

const JobDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const jobsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
      setJobs(jobsData);
    });
    return () => unsubscribe();
  }, []);

  if (showCreateForm) {
    return <CreateJobForm onBack={() => setShowCreateForm(false)} />;
  }

  if (selectedJob) {
    return <JobAdminView job={selectedJob} onBack={() => setSelectedJob(null)} />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <button onClick={() => setShowCreateForm(true)} className="bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700">
          + Create New Job
        </button>
      </div>
      <div className="space-y-4">
        {jobs.map(job => (
          <div key={job.id} onClick={() => setSelectedJob(job)} className="p-4 border rounded-lg cursor-pointer hover:bg-gray-100">
            <h2 className="text-xl font-semibold">{job.title}</h2>
            <p className={`capitalize font-medium ${job.status === 'open' ? 'text-green-600' : 'text-gray-500'}`}>
              {job.status}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobDashboard;
