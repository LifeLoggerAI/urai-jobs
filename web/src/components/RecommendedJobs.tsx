import React, { useEffect, useState } from 'react';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

const RecommendedJobs: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getRecommendedJobs = async () => {
      const recommendJobs = httpsCallable(functions, 'recommendJobs');
      try {
        const result = await recommendJobs();
        setJobs(result.data as any[]);
      } catch (error) {
        console.error('Error fetching recommended jobs:', error);
      }
      setLoading(false);
    };

    getRecommendedJobs();
  }, []);

  if (loading) {
    return <p>Loading recommended jobs...</p>;
  }

  return (
    <div>
      <h2>Recommended Jobs</h2>
      {jobs.length > 0 ? (
        <ul>
          {jobs.map((job) => (
            <li key={job.id}>
              <h3>{job.title}</h3>
              <p>{job.company}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No recommended jobs found.</p>
      )}
    </div>
  );
};

export default RecommendedJobs;
