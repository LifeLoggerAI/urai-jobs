
import React, { useState } from 'react';
import JobList from '../components/admin/JobList';
import ApplicantList from '../components/admin/ApplicantList'; // Assuming this will be created

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState('jobs');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={{ width: '220px', background: '#f4f4f4', padding: '20px' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '30px' }}>Admin Console</h1>
        <nav>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ marginBottom: '15px' }}><button onClick={() => setActiveTab('jobs')} style={{ all: 'unset', cursor: 'pointer', fontWeight: activeTab === 'jobs' ? 'bold' : 'normal' }}>Jobs</button></li>
            <li style={{ marginBottom: '15px' }}><button onClick={() => setActiveTab('applicants')} style={{ all: 'unset', cursor: 'pointer', fontWeight: activeTab === 'applicants' ? 'bold' : 'normal' }}>Applicants</button></li>
          </ul>
        </nav>
      </div>
      <div style={{ flex: 1, padding: '40px' }}>
        {activeTab === 'jobs' && <JobList />}
        {activeTab === 'applicants' && <ApplicantList />}
      </div>
    </div>
  );
};

export default Admin;
