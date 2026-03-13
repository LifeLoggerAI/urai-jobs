
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { Applicant } from '../../../packages/types/src/jobs';

const useApplicants = () => {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchApplicants = async () => {
      try {
        const q = query(collection(db, 'applicants'));
        const querySnapshot = await getDocs(q);
        const applicantsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Applicant));
        setApplicants(applicantsData);
      } catch (err) {
        setError(err as Error);
      }
      setLoading(false);
    };

    fetchApplicants();
  }, []);

  return { applicants, loading, error };
};

export default useApplicants;
