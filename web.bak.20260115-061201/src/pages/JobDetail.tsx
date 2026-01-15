import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, Link } from 'react-router-dom';

const JobDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<any>(null);

  useEffect(() => {
    const fetchJob = async () => {
      if (jobId) {
        const docRef = doc(db, 'jobPublic', jobId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setJob({ id: docSnap.id, ...docSnap.data() });
        }
      }
    };
    fetchJob();
  }, [jobId]);

  if (!job) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>{job.title}</h1>
      <p>{job.descriptionMarkdown}</p>
      <Link to={`/apply/${jobId}`}>Apply Now</Link>
    </div>
  );
};

export default JobDetail;
