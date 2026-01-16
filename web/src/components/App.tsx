import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Jobs from "./Jobs";
import Job from "./Job";
import Apply from "./Apply";
import Success from "./Success";
import Waitlist from "./Waitlist";
import Referral from "./Referral";
import Admin from "./Admin";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:jobId" element={<Job />} />
        <Route path="/apply/:jobId" element={<Apply />} />
        <Route path="/apply/success" element={<Success />} />
        <Route path="/waitlist" element={<Waitlist />} />
        <Route path="/ref/:code" element={<Referral />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  );
}

export default App;
