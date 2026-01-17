import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Job } from '../types/Job';

const JobDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      if (!jobId) return;
      try {
        const docRef = doc(db, 'jobPublic', jobId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setJob(docSnap.data() as Job);
        } else {
          console.log('No such document!');
        }
      } catch (error) {
        console.error("Error fetching job:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [jobId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!job) {
    return <div>Job not found.</div>;
  }

  return (
    <div>
      <Link to="/jobs">Back to Job Board</Link>
      <h1>{job.title}</h1>
      <p>{job.department}</p>
      <p>{job.locationType}</p>
      <p>{job.descriptionMarkdown}</p>
      <h2>Requirements</h2>
      <ul>
        {job.requirements && job.requirements.map((req, index) => (
          <li key={index}>{req}</li>
        ))}
      </ul>
      <h2>Nice to Have</h2>
      <ul>
        {job.niceToHave && job.niceToHave.map((req, index) => (
          <li key={index}>{req}</li>
        ))}
      </ul>
      <Link to={`/apply/${jobId}`}>Apply</Link>
    </div>
  );
};

export default JobDetail;
