import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Job {
  id: string;
  title: string;
  department: string;
  locationType: string;
  locationText: string;
  employmentType: string;
}

const JobListPage: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      const jobsCollection = collection(db, 'jobPublic');
      const jobSnapshot = await getDocs(jobsCollection);
      const jobList = jobSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
      setJobs(jobList);
      setLoading(false);
    };

    fetchJobs();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Open Positions</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {jobs.map(job => (
          <Link to={`/jobs/${job.id}`} key={job.id} className="block p-6 bg-white rounded-lg border border-gray-200 shadow-md hover:bg-gray-100">
            <h2 className="text-xl font-bold">{job.title}</h2>
            <p className="text-gray-600">{job.department}</p>
            <p className="text-gray-500 mt-2">{job.locationType} - {job.locationText}</p>
            <p className="text-sm text-gray-500 mt-1">{job.employmentType.replace('_', ' ')}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default JobListPage;
