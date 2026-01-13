import React from 'react';

const ApplySuccess: React.FC = () => {
  return (
    <div className="container mx-auto p-4 text-center">
      <h1 className="text-2xl font-bold mb-4">Application Submitted!</h1>
      <p>Thank you for applying. We will review your application and get back to you soon.</p>
      <a href="/jobs" className="text-blue-500">Return to Job Board</a>
    </div>
  );
};

export default ApplySuccess;
