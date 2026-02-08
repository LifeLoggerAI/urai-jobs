import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import JobListPage from './pages/JobListPage';
import JobDetailPage from './pages/JobDetailPage';
import ApplyPage from './pages/ApplyPage';
import ApplySuccessPage from './pages/ApplySuccessPage';
import WaitlistPage from './pages/WaitlistPage';
import ReferralPage from './pages/ReferralPage';
import AdminPage from './pages/AdminPage';
import './App.css';

const App: React.FC = () => {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/jobs" element={<JobListPage />} />
          <Route path="/jobs/:jobId" element={<JobDetailPage />} />
          <Route path="/apply/:jobId" element={<ApplyPage />} />
          <Route path="/apply/success" element={<ApplySuccessPage />} />
          <Route path="/waitlist" element={<WaitlistPage />} />
          <Route path="/ref/:code" element={<ReferralPage />} />
          <Route path="/admin" element={<AdminPage />} />
          {/* Redirect root to jobs page for now */}
          <Route path="/" element={<JobListPage />} />
        </Routes>
      </MainLayout>
    </Router>
  );
};

export default App;
