import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import JobBoard from "./pages/JobBoard";
import JobDetail from "./pages/JobDetail";
import Apply from "./pages/Apply";
import ApplySuccess from "./pages/ApplySuccess";
import Waitlist from "./pages/Waitlist";
import Referral from "./pages/Referral";
import Admin from "./pages/Admin";

function App() {
  return (
    <Router>
      <div>
        <nav>
          <ul>
            <li><Link to="/jobs">Job Board</Link></li>
            <li><Link to="/jobs/1">Job Detail</Link></li>
            <li><Link to="/apply/1">Apply</Link></li>
            <li><Link to="/apply/success">Apply Success</Link></li>
            <li><Link to="/waitlist">Waitlist</Link></li>
            <li><Link to="/ref/abc">Referral</Link></li>
            <li><Link to="/admin">Admin</Link></li>
          </ul>
        </nav>

        <Routes>
          <Route path="/jobs" element={<JobBoard />} />
          <Route path="/jobs/:jobId" element={<JobDetail />} />
          <Route path="/apply/:jobId" element={<Apply />} />
          <Route path="/apply/success" element={<ApplySuccess />} />
          <Route path="/waitlist" element={<Waitlist />} />
          <Route path="/ref/:code" element={<Referral />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
