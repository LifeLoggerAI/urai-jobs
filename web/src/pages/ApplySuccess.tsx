
import React from 'react';
import { Link } from 'react-router-dom';

const ApplySuccess: React.FC = () => {
  return (
    <div>
      <h1>Application Submitted!</h1>
      <p>Thank you for applying. We will review your application and get back to you soon.</p>
      <Link to="/jobs">Back to Job Board</Link>
    </div>
  );
};

export default ApplySuccess;
