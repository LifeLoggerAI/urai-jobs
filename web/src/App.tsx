import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import JobListings from './components/JobListings';
import JobDetails from './components/JobDetails';
import Apply from './components/Apply';
import Admin from './components/Admin';

function App() {
  return (
    <Router>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/admin">Admin</Link>
      </nav>
      <Routes>
        <Route path="/" element={<JobListings />} />
        <Route path="/job/:jobId" element={<JobDetails />} />
        <Route path="/apply/:jobId" element={<Apply />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  );
}

export default App;
