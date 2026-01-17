import React from 'react';
import { Link } from 'react-router-dom';

const ApplySuccess: React.FC = () => {
  return (
    <div style={{ textAlign: 'center', paddingTop: '50px' }}>
      <h1>Application Submitted!</h1>
      <p>Thank you for applying. We will review your application and be in touch.</p>
      <Link to="/jobs">Return to Job Board</Link>
    </div>
  );
};

export default ApplySuccess;
