import React from 'react';
import { Link } from 'react-router-dom';

const ApplySuccessPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4 text-center">
      <h1 className="text-3xl font-bold text-green-600 mb-4">Application Submitted!</h1>
      <p className="text-lg mb-6">Thank you for your interest. We will review your application and be in touch.</p>
      <Link to="/jobs" className="text-blue-600 hover:underline">Return to Job Board</Link>
    </div>
  );
};

export default ApplySuccessPage;
