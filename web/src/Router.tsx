import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Jobs from './pages/Jobs';
import Job from './pages/Job';
import Apply from './pages/Apply';
import ApplySuccess from './pages/ApplySuccess';
import Waitlist from './pages/Waitlist';
import Referral from './pages/Referral';
import Admin from './pages/Admin';

const Router: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:jobId" element={<Job />} />
        <Route path="/apply/:jobId" element={<Apply />} />
        <Route path="/apply/success" element={<ApplySuccess />} />
        <Route path="/waitlist" element={<Waitlist />} />
        <Route path="/ref/:code" element={<Referral />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
