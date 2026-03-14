import React, { useEffect, useState } from 'react';
import { getJobs } from '../firebase'; // Assuming you have a function to get jobs from Firebase

const JobsPage = () => {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    // In a real application, you would fetch the jobs from your backend
    const fetchJobs = async () => {
      const jobsData = await getJobs({});
      setJobs(jobsData.jobs);
    };
    fetchJobs();
  }, []);

  return (
    <div>
      <h1>Job Listings</h1>
      {jobs.map((job) => (
        <div key={job.id}>
          <h2>{job.title}</h2>
          <p>{job.company}</p>
          <p>{job.description}</p>
        </div>
      ))}
    </div>
  );
};

export default JobsPage;
