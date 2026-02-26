
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import JobBoard from './components/JobBoard';
import JobDetail from './components/JobDetail';
import ApplicationForm from './components/ApplicationForm';
import ApplicationSuccess from './components/ApplicationSuccess';
import Waitlist from './components/Waitlist';
import Referral from './components/Referral';
import Admin from './components/Admin';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/jobs" element={<JobBoard />} />
        <Route path="/jobs/:jobId" element={<JobDetail />} />
        <Route path="/apply/:jobId" element={<ApplicationForm />} />
        <Route path="/apply/success" element={<ApplicationSuccess />} />
        <Route path="/waitlist" element={<Waitlist />} />
        <Route path="/ref/:code" element={<Referral />} />
        <Route path="/admin/*" element={<Admin />} />
      </Routes>
    </Router>
  );
}

export default App;
