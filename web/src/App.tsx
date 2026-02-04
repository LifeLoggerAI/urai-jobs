import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Admin from './pages/Admin';
import Apply from './pages/Apply';
import ApplySuccess from './pages/ApplySuccess';
import JobDetail from './pages/JobDetail';
import Jobs from './pages/Jobs';
import Referral from './pages/Referral';
import Waitlist from './pages/Waitlist';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="/apply/:jobId" element={<Apply />} />
        <Route path="/apply/success" element={<ApplySuccess />} />
        <Route path="/jobs/:jobId" element={<JobDetail />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/ref/:code" element={<Referral />} />
        <Route path="/waitlist" element={<Waitlist />} />
      </Routes>
    </Router>
  );
};

export default App;
