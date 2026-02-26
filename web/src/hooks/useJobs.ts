
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Job } from '../../../packages/types/src/jobs';

const useJobs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'jobs'));
      const querySnapshot = await getDocs(q);
      const jobsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
      setJobs(jobsData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const addJob = async (jobData: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await addDoc(collection(db, 'jobs'), {
        ...jobData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      fetchJobs(); // Refetch jobs after adding
    } catch (err) {
      console.error("Error adding job: ", err);
      setError(err as Error);
    }
  };

  const updateJob = async (id: string, jobData: Partial<Omit<Job, 'id' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const jobRef = doc(db, 'jobs', id);
      await updateDoc(jobRef, {
        ...jobData,
        updatedAt: serverTimestamp(),
      });
      fetchJobs(); // Refetch jobs after updating
    } catch (err) {
      console.error("Error updating job: ", err);
      setError(err as Error);
    }
  };

  const deleteJob = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'jobs', id));
      fetchJobs(); // Refetch jobs after deleting
    } catch (err) {
      console.error("Error deleting job: ", err);
      setError(err as Error);
    }
  };


  return { jobs, loading, error, addJob, updateJob, deleteJob };
};

export default useJobs;
