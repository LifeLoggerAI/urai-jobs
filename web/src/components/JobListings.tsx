import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase'; // You'll need to create this file

const JobListings = () => {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    const fetchJobs = async () => {
      const jobsCollection = collection(db, 'jobPublic');
      const jobSnapshot = await getDocs(jobsCollection);
      const jobList = jobSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setJobs(jobList);
    };

    fetchJobs();
  }, []);

  return (
    <div>
      <h2>Job Openings</h2>
      <ul>
        {jobs.map(job => (
          <li key={job.id}>
            <Link to={`/job/${job.id}`}>{job.title}</Link> - {job.locationText}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default JobListings;
