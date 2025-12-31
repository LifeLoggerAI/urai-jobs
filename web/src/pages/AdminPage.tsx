import React from 'react';
import { Link, Outlet } from 'react-router-dom';

const AdminPage: React.FC = () => {
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <nav>
        <ul>
          <li>
            <Link to="/admin/jobs">Jobs</Link>
          </li>
          <li>
            <Link to="/admin/applicants">Applicants</Link>
          </li>
          <li>
            <Link to="/admin/metrics">Metrics</Link>
          </li>
        </ul>
      </nav>
      <hr />
      <Outlet />
    </div>
  );
};

export default AdminPage;
