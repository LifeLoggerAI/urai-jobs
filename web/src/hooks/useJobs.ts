
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query } from 'firebase/firestore';

interface Job {
  id: string;
  title: string;
  department: string;
  locationType: string;
  locationText: string;
  employmentType: string;
}

const useJobs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const q = query(collection(db, 'jobPublic'));
        const querySnapshot = await getDocs(q);
        const jobsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
        setJobs(jobsData);
      } catch (err) {
        setError(err as Error);
      }
      setLoading(false);
    };

    fetchJobs();
  }, []);

  return { jobs, loading, error };
};

export default useJobs;
