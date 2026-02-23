
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface Job {
  id: string;
  title: string;
  department: string;
  locationType: string;
  locationText: string;
  employmentType: string;
  descriptionMarkdown: string;
  requirements: string[];
  niceToHave: string[];
}

const useJob = (jobId: string) => {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const docRef = doc(db, 'jobPublic', jobId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setJob({ id: docSnap.id, ...docSnap.data() } as Job);
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
