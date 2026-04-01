
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../firebase';

const DashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  return (
    <div>
      <h1>Dashboard</h1>
      {currentUser && <p>Welcome, {currentUser.email}!</p>}
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
};

export default DashboardPage;
