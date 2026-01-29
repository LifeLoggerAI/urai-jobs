import React from 'react';

const useAdminAuth = () => {
  console.warn("AdminGate: Using placeholder auth logic. Access is currently denied to all.");
  return { isAdmin: false, loading: false };
};

interface AdminGateProps {
  children: React.ReactNode;
}

const AdminGate: React.FC<AdminGateProps> = ({ children }) => {
  const { isAdmin, loading } = useAdminAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Access Restricted</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminGate;
