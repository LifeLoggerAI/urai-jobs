import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-xl mb-4">Page Not Found</p>
      <Link to="/" className="text-blue-600 hover:underline">Go back to the homepage</Link>
    </div>
  );
};

export default NotFound;
