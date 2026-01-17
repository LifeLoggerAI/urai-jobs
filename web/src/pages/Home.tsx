import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div style={{ textAlign: 'center', paddingTop: '50px' }}>
      <h1>Welcome to URAI Jobs</h1>
      <p>Find your next role at the forefront of AI.</p>
      <Link to="/jobs">View Open Positions</Link>
    </div>
  );
};

export default Home;
