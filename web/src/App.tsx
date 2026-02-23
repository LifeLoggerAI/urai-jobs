
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import JobBoard from './pages/JobBoard';
import JobDetail from './pages/JobDetail';
import Apply from './pages/Apply';
import ApplySuccess from './pages/ApplySuccess';
import Waitlist from './pages/Waitlist';
import Referral from './pages/Referral';
import AdminLayout from './pages/admin/AdminLayout';
import Admin from './pages/admin/Admin';
import AdminJobs from './pages/admin/Jobs';
import NewJob from './pages/admin/NewJob';
import EditJob from './pages/admin/EditJob';
import { AuthProvider } from './hooks/useAuth';

const App: React.FC = () => {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<JobBoard />} />
        <Route path="/jobs" element={<JobBoard />} />
        <Route path="/jobs/:jobId" element={<JobDetail />} />
        <Route path="/apply/:jobId" element={<Apply />} />
        <Route path="/apply/success" element={<ApplySuccess />} />
        <Route path="/waitlist" element={<Waitlist />} />
        <Route path="/ref/:code" element={<Referral />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Admin />} />
          <Route path="jobs" element={<AdminJobs />} />
          <Route path="jobs/new" element={<NewJob />} />
          <Route path="jobs/edit/:id" element={<EditJob />} />
        </Route>
      </Routes>
    </Router>
  );
};

const AppWithAuth = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);

export default AppWithAuth;
