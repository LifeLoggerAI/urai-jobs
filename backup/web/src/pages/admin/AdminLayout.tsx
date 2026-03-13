
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const AdminLayout: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" />;
  }

  return (
    <div>
      <h1>Admin</h1>
      <Outlet />
    </div>
  );
};

export default AdminLayout;
