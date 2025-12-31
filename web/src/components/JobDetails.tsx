import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const JobDetails = () => {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);

  useEffect(() => {
    const fetchJob = async () => {
      const jobDoc = doc(db, 'jobPublic', jobId);
      const jobSnapshot = await getDoc(jobDoc);
      if (jobSnapshot.exists()) {
        setJob(jobSnapshot.data());
      }
    };

    fetchJob();
  }, [jobId]);

  if (!job) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h2>{job.title}</h2>
      <p>{job.department}</p>
      <p>{job.locationText}</p>
      <p>{job.employmentType}</p>
      <div dangerouslySetInnerHTML={{ __html: job.descriptionMarkdown }} />
      <h3>Requirements</h3>
      <ul>
        {job.requirements.map((req, index) => (
          <li key={index}>{req}</li>
        ))}
      </ul>
      <h3>Nice to Have</h3>
      <ul>
        {job.niceToHave.map((req, index) => (
          <li key={index}>{req}</li>
        ))}
      </ul>
      <Link to={`/apply/${jobId}`}>Apply Now</Link>
    </div>
  );
};

export default JobDetails;
