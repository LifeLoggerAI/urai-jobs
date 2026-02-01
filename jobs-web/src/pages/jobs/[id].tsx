
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../lib/auth';

const JobPage = () => {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [job, setJob] = useState(null);

  useEffect(() => {
    if (!user || !id) return;

    const db = getFirestore();
    const jobRef = doc(db, 'jobs', id as string);

    const unsubscribe = onSnapshot(jobRef, (doc) => {
      if (doc.exists()) {
        setJob({ id: doc.id, ...doc.data() });
      } else {
        // Handle not found
      }
    });

    return () => unsubscribe();
  }, [user, id]);

  if (!job) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Job Details</h1>
      <p>Type: {job.type}</p>
      <p>Status: {job.status}</p>
      {/* Add more job details and actions here */}
    </div>
  );
};

export default JobPage;
