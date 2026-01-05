import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import JobsPage from './pages/JobsPage';
import JobDetailPage from './pages/JobDetailPage';
import ApplyPage from './pages/ApplyPage';
import ApplySuccessPage from './pages/ApplySuccessPage';
import WaitlistPage from './pages/WaitlistPage';
import ReferralPage from './pages/ReferralPage';
import AdminPage from './pages/AdminPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminJobsPage from './pages/AdminJobsPage';
import AdminApplicantsPage from './pages/AdminApplicantsPage';
import AdminMetricsPage from './pages/AdminMetricsPage';
import ProtectedRoute from './components/ProtectedRoute';

const Router: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
        <Route path="/apply/:jobId" element={<ApplyPage />} />
        <Route path="/apply/success" element={<ApplySuccessPage />} />
        <Route path="/waitlist" element={<WaitlistPage />} />
        <Route path="/ref/:code" element={<ReferralPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={<ProtectedRoute><AdminPage /></ProtectedRoute>}>
          <Route path="jobs" element={<AdminJobsPage />} />
          <Route path="applicants" element={<AdminApplicantsPage />} />
          <Route path="metrics" element={<AdminMetricsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
