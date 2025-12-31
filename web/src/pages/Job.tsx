import React from 'react';
import { useParams } from 'react-router-dom';

const Job: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();

  return (
    <div>
      <h1>Job Details</h1>
      <p>Job ID: {jobId}</p>
    </div>
  );
};

export default Job;
