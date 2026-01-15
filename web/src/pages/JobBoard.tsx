import React from "react";
import { useJobs } from "../hooks/useJobs";
import { Link } from "react-router-dom";

const JobBoard: React.FC = () => {
  const { jobs, loading } = useJobs();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Job Board</h1>
      {jobs.length === 0 ? (
        <p>No open positions at this time.</p>
      ) : (
        <ul>
          {jobs.map((job) => (
            <li key={job.id}>
              <Link to={`/jobs/${job.id}`}>
                <h2>{job.title}</h2>
                <p>
                  {job.department} - {job.locationText}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default JobBoard;
