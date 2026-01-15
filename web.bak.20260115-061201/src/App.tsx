import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import JobList from './pages/JobList';
import JobDetail from './pages/JobDetail';
import Apply from './pages/Apply';
import Admin from './pages/Admin';
import Waitlist from './pages/Waitlist';
import Referral from './pages/Referral';
import Success from './pages/Success';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/jobs" element={<JobList />} />
        <Route path="/jobs/:jobId" element={<JobDetail />} />
        <Route path="/apply/:jobId" element={<Apply />} />
        <Route path="/apply/success" element={<Success />} />
        <Route path="/waitlist" element={<Waitlist />} />
        <Route path="/ref/:code" element={<Referral />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/" element={<JobList />} />
      </Routes>
    </Router>
  );
};

export default App;
