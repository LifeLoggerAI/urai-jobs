import React from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';

const AdminLoginPage: React.FC = () => {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in with Google', error);
    }
  };

  return (
    <div>
      <h1>Admin Login</h1>
      <button onClick={handleLogin}>Sign in with Google</button>
    </div>
  );
};

export default AdminLoginPage;
