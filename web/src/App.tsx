import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import JobListPage from './pages/JobListPage';
import JobDetailPage from './pages/JobDetailPage';
import ApplyPage from './pages/ApplyPage';
import ApplySuccessPage from './pages/ApplySuccessPage';
import WaitlistPage from './pages/WaitlistPage';
import ReferralPage from './pages/ReferralPage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/jobs" element={<JobListPage />} />
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
        <Route path="/apply/:jobId" element={<ApplyPage />} />
        <Route path="/apply/success" element={<ApplySuccessPage />} />
        <Route path="/waitlist" element={<WaitlistPage />} />
        <Route path="/ref/:code" element={<ReferralPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;
