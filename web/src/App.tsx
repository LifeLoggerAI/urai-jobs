import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Admin from './pages/Admin';
import Apply from './pages/Apply';
import JobDetail from './pages/JobDetail';
import Jobs from './pages/Jobs';
import Referral from './pages/Referral';
import Waitlist from './pages/Waitlist';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:jobId" element={<JobDetail />} />
        <Route path="/apply/:jobId" element={<Apply />} />
        <Route path="/waitlist" element={<Waitlist />} />
        <Route path="/ref/:code" element={<Referral />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
