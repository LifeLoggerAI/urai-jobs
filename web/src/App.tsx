import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import JobListings from './components/JobListings';
import JobDetails from './components/JobDetails';
import Apply from './components/Apply';
import ApplySuccess from './components/ApplySuccess';
import Waitlist from './components/Waitlist';
import Referral from './components/Referral';
import Admin from './components/Admin';

function App() {
  return (
    <Router>
      <nav>
        <Link to="/jobs">Jobs</Link>
        <Link to="/waitlist">Waitlist</Link>
        <Link to="/admin">Admin</Link>
      </nav>
      <Routes>
        <Route path="/jobs" element={<JobListings />} />
        <Route path="/jobs/:jobId" element={<JobDetails />} />
        <Route path="/apply/:jobId" element={<Apply />} />
        <Route path="/apply/success" element={<ApplySuccess />} />
        <Route path="/waitlist" element={<Waitlist />} />
        <Route path="/ref/:code" element={<Referral />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  );
}

export default App;
