import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Job {
  id: string;
  title: string;
  department: string;
  locationType: string;
  employmentType: string;
}

const JobsPage: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      const q = query(collection(db, 'jobPublic'), where('status', '==', 'open'));
      const querySnapshot = await getDocs(q);
      const jobsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
      setJobs(jobsData);
      setLoading(false);
    };

    fetchJobs();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Open Positions</h1>
      {loading ? (
        <p>Loading jobs...</p>
      ) : jobs.length > 0 ? (
        <div className="space-y-4">
          {jobs.map(job => (
            <div key={job.id} className="p-4 border rounded-lg">
              <Link to={`/jobs/${job.id}`} className="text-xl font-semibold text-blue-600 hover:underline">{job.title}</Link>
              <p className="text-gray-600">{job.department} &middot; {job.locationType} &middot; {job.employmentType}</p>
            </div>
          ))}
        </div>
      ) : (
        <p>No open positions at this time. Please check back later.</p>
      )}
    </div>
  );
};

export default JobsPage;
