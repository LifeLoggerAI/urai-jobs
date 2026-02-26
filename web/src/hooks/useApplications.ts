
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Application } from '../../../packages/types/src/jobs';

const useApplications = (applicantId: string) => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!applicantId) return;

    const fetchApplications = async () => {
      try {
        const q = query(collection(db, 'applications'), where('applicantId', '==', applicantId));
        const querySnapshot = await getDocs(q);
        const applicationsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Application));
        setApplications(applicationsData);
      } catch (err) {
        setError(err as Error);
      }
      setLoading(false);
    };

    fetchApplications();
  }, [applicantId]);

  return { applications, loading, error };
};

export default useApplications;
