
import React from 'react';
import { Link } from 'react-router-dom';
import useJobs from '../hooks/useJobs';

const Jobs: React.FC = () => {
  const { jobs, loading, error, retry } = useJobs();

  if (loading) {
    return <div>Loading available positions...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Oops! Something went wrong.</h2>
        <p>We couldn't load our open positions right now. Please check your connection or try again.</p>
        <button onClick={retry}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Open Positions</h1>
      <div className="job-listings">
        {jobs.map(job => (
          <div key={job.id} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
            <h2 style={{ marginTop: 0 }}>
              <Link to={`/jobs/${job.id}`} style={{ textDecoration: 'none', color: '#333' }}>{job.title}</Link>
            </h2>
            <p style={{ color: '#666', marginBottom: '10px' }}>{job.department} | {job.locationType} | {job.employmentType}</p>
            <p>{job.descriptionMarkdown.substring(0, 150)}...</p>
            <Link to={`/jobs/${job.id}`} className="button">View Details</Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Jobs;
