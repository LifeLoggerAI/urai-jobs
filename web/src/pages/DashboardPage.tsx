import React from 'react';
import RecommendedJobs from '../components/RecommendedJobs';

const DashboardPage: React.FC = () => {
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome to your dashboard!</p>
      <RecommendedJobs />
    </div>
  );
};

export default DashboardPage;
