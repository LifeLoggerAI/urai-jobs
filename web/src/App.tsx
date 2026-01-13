import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import Apply from './pages/Apply';
import ApplySuccess from './pages/ApplySuccess';
import Waitlist from './pages/Waitlist';
import Admin from './pages/Admin';
import Referral from './pages/Referral';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:jobId" element={<JobDetail />} />
        <Route path="/apply/:jobId" element={<Apply />} />
        <Route path="/apply/success" element={<ApplySuccess />} />
        <Route path="/waitlist" element={<Waitlist />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/ref/:code" element={<Referral />} />
        <Route path="/" element={<Jobs />} />
      </Routes>
    </Router>
  );
}

export default App;
