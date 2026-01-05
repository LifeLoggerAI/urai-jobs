import { Link } from 'react-router-dom';

const ApplySuccessPage = () => {
  return (
    <div className="container mx-auto p-4 text-center max-w-lg">
        <div className="bg-white shadow-md rounded-lg p-8 mt-10">
            <svg className="mx-auto h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-3xl font-bold text-gray-800 mt-4 mb-2">Application Submitted!</h1>
            <p className="text-gray-600 mb-6">Thank you for your interest. We will review your application and be in touch if your qualifications match our needs.</p>
            <Link to="/jobs" className="text-blue-600 hover:underline font-semibold">Return to Job Listings</Link>
        </div>
    </div>
  );
};

export default ApplySuccessPage;
