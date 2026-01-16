import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const Jobs = () => {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    const fetchJobs = async () => {
      const querySnapshot = await getDocs(collection(db, 'jobPublic'));
      const jobsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setJobs(jobsData);
    };

    fetchJobs();
  }, []);

  return (
    <div>
      <h1>Open Positions</h1>
      <ul>
        {jobs.map((job) => (
          <li key={job.id}>
            <Link to={`/jobs/${job.id}`}>
              <h2>{job.title}</h2>
            </Link>
            <p>{job.department}</p>
            <p>{job.locationType}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Jobs;
