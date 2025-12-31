import React from 'react';
import { Link } from 'react-router-dom';

const ApplySuccessPage = () => {
  return (
    <div className="container mx-auto p-4 text-center">
      <h1 className="text-2xl font-bold mb-4">Application Submitted!</h1>
      <p className="text-lg mb-4">Thank you for your interest. We will review your application and be in touch if your qualifications match our needs.</p>
      <Link to="/jobs" className="text-blue-500 hover:underline">Return to Job Listings</Link>
    </div>
  );
};

export default ApplySuccessPage;
