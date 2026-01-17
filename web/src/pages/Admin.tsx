import React from 'react';
import { useAdmin } from '../hooks/useAdmin';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithRedirect } from 'firebase/auth';

const Admin: React.FC = () => {
  const { user, isAdmin, loading } = useAdmin();

  const signIn = () => {
    const provider = new GoogleAuthProvider();
    signInWithRedirect(auth, provider);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <button onClick={signIn}>Sign in with Google</button>;
  }

  if (!isAdmin) {
    return <div>You are not authorized to view this page.</div>;
  }

  return (
    <div>
      <h1>Admin Console</h1>
      <p>Welcome, {user.displayName}!</p>
      {/* Job CRUD, applicant viewer, etc. will go here */}
    </div>
  );
};

export default Admin;
