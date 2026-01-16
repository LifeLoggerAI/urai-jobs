import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const JobDetail = () => {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);

  useEffect(() => {
    const fetchJob = async () => {
      const docRef = doc(db, 'jobPublic', jobId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setJob(docSnap.data());
      } else {
        // doc.data() will be undefined in this case
        console.log('No such document!');
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
      <p>{job.department}</p>
      <p>{job.locationType}</p>
      <p>{job.descriptionMarkdown}</p>
      <h2>Requirements</h2>
      <ul>
        {job.requirements.map((req, index) => (
          <li key={index}>{req}</li>
        ))}
      </ul>
      <h2>Nice to Have</h2>
      <ul>
        {job.niceToHave.map((req, index) => (
          <li key={index}>{req}</li>
        ))}
      </ul>
      <Link to={`/apply/${jobId}`}>Apply</Link>
    </div>
  );
};

export default JobDetail;
