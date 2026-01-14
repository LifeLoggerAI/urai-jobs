import React from 'react';
import { Link } from 'react-router-dom';

const Success: React.FC = () => {
  return (
    <div>
      <h1>Application Submitted!</h1>
      <p>Thank you for applying. We will review your application and be in touch.</p>
      <Link to="/jobs">Back to Job Listings</Link>
    </div>
  );
};

export default Success;
