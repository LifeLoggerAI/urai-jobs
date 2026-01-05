import React from 'react';
import { useParams } from 'react-router-dom';

const Apply: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();

  return (
    <div>
      <h1>Apply for Job</h1>
      <p>Job ID: {jobId}</p>
      {/* Add application form here */}
    </div>
  );
};

export default Apply;
