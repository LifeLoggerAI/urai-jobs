import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

const JobDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEmployer, setIsEmployer] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<any>(null);

  useEffect(() => {
    const fetchJob = async () => {
      if (!jobId) return;
      const docRef = doc(db, 'jobs', jobId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const jobData = { id: docSnap.id, ...docSnap.data() };
        setJob(jobData);
        const user = auth.currentUser;
        if (user && user.uid === jobData.employerId) {
          setIsEmployer(true);
        }
      } else {
        console.log('No such document!');
      }
      setLoading(false);
    };

    fetchJob();
  }, [jobId]);

  const handleMatch = async () => {
    setMatching(true);
    const aiJobMatcher = httpsCallable(functions, 'aiJobMatcher');
    try {
      const result = await aiJobMatcher({ jobId });
      setMatchResult(result.data);
    } catch (error) {
      console.error('Error matching candidates:', error);
    }
    setMatching(false);
  };

  if (loading) {
    return <p>Loading job details...</p>;
  }

  if (!job) {
    return <p>Job not found</p>;
  }

  return (
    <div>
      <h1>{job.title}</h1>
      <h2>{job.company}</h2>
      <p>{job.description}</p>
      {isEmployer ? (
        <button onClick={handleMatch} disabled={matching}>
          {matching ? 'Matching...' : 'Match Candidates'}
        </button>
      ) : (
        <Link to={`/apply/${job.id}`}>Apply Now</Link>
      )}
      {matchResult && (
        <div>
          <h2>Matching Results</h2>
          <pre>{JSON.stringify(matchResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default JobDetail;
