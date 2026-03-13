import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import Apply from './pages/Apply';
import ApplySuccess from './pages/ApplySuccess';
import Waitlist from './pages/Waitlist';
import Referral from './pages/Referral';
import AdminLayout from './pages/admin/AdminLayout';
import AdminJobs from './pages/admin/Jobs';
import EditJob from './pages/admin/EditJob';
import NewJob from './pages/admin/NewJob';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:jobId" element={<JobDetail />} />
        <Route path="/apply/:jobId" element={<Apply />} />
        <Route path="/apply/success" element={<ApplySuccess />} />
        <Route path="/waitlist" element={<Waitlist />} />
        <Route path="/ref/:code" element={<Referral />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminJobs />} />
          <Route path="jobs" element={<AdminJobs />} />
          <Route path="jobs/new" element={<NewJob />} />
          <Route path="jobs/:jobId/edit" element={<EditJob />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
