
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Job } from '../../../packages/types/src/jobs';

const useJob = (jobId: string) => {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      return;
    }

    const fetchJob = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'jobs', jobId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setJob({ id: docSnap.id, ...docSnap.data() } as Job);
        } else {
          setError(new Error('Job not found'));
        }
      } catch (err) {
        setError(err as Error);
      }
      setLoading(false);
    };

    fetchJob();
  }, [jobId]);

  return { job, loading, error };
};

export default useJob;
