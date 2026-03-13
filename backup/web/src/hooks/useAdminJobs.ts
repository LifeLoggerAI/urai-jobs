import { useState, useEffect } from 'react';
import { db, ORG_ID } from '../lib/firebase'; // Corrected import path
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Job } from '../../types'; // Assuming types are in a higher-level directory

const useAdminJobs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Scoped query to the organization's jobs subcollection
    const q = query(collection(db, `orgs/${ORG_ID}/jobs`), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Job));
      setJobs(jobsData);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching admin jobs:", err);
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { jobs, loading, error };
};

export default useAdminJobs;
