
import { useEffect, useState } from 'react';
import { getFirestore, collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { useAuth } from '../lib/auth';

const JobsPage = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    if (!user) return;

    const db = getFirestore();
    const q = query(
      collection(db, 'jobs'),
      where('ownerUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setJobs(jobs);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div>
      <h1>Jobs</h1>
      <ul>
        {jobs.map((job) => (
          <li key={job.id}>
            {job.type} - {job.status}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default JobsPage;
