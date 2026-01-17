import React from 'react';
import { Link, Outlet } from 'react-router-dom';

const Layout: React.FC = () => {
  return (
    <div>
      <nav style={{ padding: '20px', borderBottom: '1px solid #ccc' }}>
        <Link to="/" style={{ marginRight: '20px' }}>Home</Link>
        <Link to="/jobs">Jobs</Link>
        <Link to="/waitlist" style={{ marginLeft: '20px' }}>Waitlist</Link>
        <Link to="/admin" style={{ marginLeft: 'auto' }}>Admin</Link>
      </nav>
      <main style={{ padding: '20px' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
