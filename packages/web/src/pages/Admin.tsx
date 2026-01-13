import React, { useState } from 'react';

const Admin: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    // TODO: Replace with Firebase Auth
    if (password === 'password') {
      setIsAuthenticated(true);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Admin Login</h1>
        <div className="flex">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-2 border rounded-l-lg"
            placeholder="Password"
          />
          <button onClick={handleLogin} className="bg-blue-500 text-white px-4 py-2 rounded-r-lg">Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Console</h1>
      {/* Add admin content here */}
    </div>
  );
};

export default Admin;
