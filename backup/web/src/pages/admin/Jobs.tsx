
import React from 'react';
import { Link } from 'react-router-dom';
import useAdminJobs from '../../hooks/useAdminJobs';

const AdminJobs: React.FC = () => {
  const { jobs, loading, error } = useAdminJobs();

  if (loading) {
    return <div>Loading jobs...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      <h2>Manage Jobs</h2>
      <Link to="/admin/jobs/new">Create New Job</Link>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map(job => (
            <tr key={job.id}>
              <td>{job.title}</td>
              <td>{job.status}</td>
              <td>
                <Link to={`/admin/jobs/edit/${job.id}`}>Edit</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminJobs;
