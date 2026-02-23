
import React from 'react';
import { Link } from 'react-router-dom';
import useJobs from '../hooks/useJobs';

const Jobs: React.FC = () => {
  const { jobs, loading, error } = useJobs();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      <h1>Job Board</h1>
      <ul>
        {jobs.map(job => (
          <li key={job.id}>
            <Link to={`/jobs/${job.id}`}>{job.title}</Link>
            <p>{job.department} - {job.locationType}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Jobs;
