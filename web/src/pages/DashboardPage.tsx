import React from 'react';
import LatestJobs from '../components/LatestJobs';

const DashboardPage: React.FC = () => {
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome to your dashboard!</p>
      <LatestJobs />
    </div>
  );
};

export default DashboardPage;
