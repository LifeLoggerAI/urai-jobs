import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';

const JobsPage = () => {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    const fetchJobs = async () => {
      const jobsCollection = collection(db, 'jobPublic');
      const q = query(jobsCollection, where('status', '==', 'open'));
      const jobSnapshot = await getDocs(q);
      const jobList = jobSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setJobs(jobList);
    };

    fetchJobs();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Open Positions</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {jobs.map(job => (
          <div key={job.id} className="border p-4 rounded-lg">
            <h2 className="text-xl font-semibold">{job.title}</h2>
            <p className="text-gray-600">{job.department}</p>
            <p className="text-gray-500">{job.locationText}</p>
            <Link to={`/jobs/${job.id}`} className="text-blue-500 hover:underline mt-2 inline-block">View Details</Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobsPage;
