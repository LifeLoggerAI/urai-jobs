import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { firestore } from '../firebase';
import { Link } from 'react-router-dom';

interface Job {
  id: string;
  title: string;
  department: string;
  locationType: 'remote' | 'hybrid' | 'onsite';
  locationText: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
}

const Jobs: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const jobsCollection = collection(firestore, 'jobPublic');
        const q = query(jobsCollection);
        const querySnapshot = await getDocs(q);
        const jobsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
        setJobs(jobsData);
      } catch (err) {
        setError('Failed to fetch jobs. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>Open Positions</h1>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {jobs.length > 0 ? (
            jobs.map(job => (
              <div key={job.id} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: '0 0 0.5rem 0' }}>{job.title}</h2>
                  <p style={{ margin: 0, color: '#555' }}>
                    {job.department} &middot; {job.locationType} ({job.locationText}) &middot; {job.employmentType}
                  </p>
                </div>
                <Link to={`/jobs/${job.id}`} style={{ textDecoration: 'none', color: '#007bff', fontWeight: 'bold' }}>
                  View Details
                </Link>
              </div>
            ))
          ) : (
            <p>No open positions at this time. Please check back later.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Jobs;
