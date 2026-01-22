import React from 'react';
import { Link, Outlet } from 'react-router-dom';

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-800 text-white p-4">
        <nav className="container mx-auto flex justify-between">
          <Link to="/" className="font-bold text-xl">URAI Jobs</Link>
          <div>
            <Link to="/jobs" className="mr-4">Jobs</Link>
            <Link to="/waitlist" className="mr-4">Waitlist</Link>
            <Link to="/admin">Admin</Link>
          </div>
        </nav>
      </header>
      <main className="flex-grow container mx-auto p-4">
        <Outlet />
      </main>
      <footer className="bg-gray-200 p-4 text-center">
        <p>&copy; 2024 URAI Labs. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Layout;
