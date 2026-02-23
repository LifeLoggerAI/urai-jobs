
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import JobForm from '../../components/admin/JobForm';
import { Job } from '../../../types';

const EditJob: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = React.useState<Job | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchJob = async () => {
      const docRef = doc(db, 'jobs', id!);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setJob({ ...docSnap.data(), id: docSnap.id } as Job);
      }
    };
    fetchJob();
  }, [id]);

  const handleSubmit = async (data: Job) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'jobs', id!);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
      navigate('/admin/jobs');
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  if (!job) {
    return <div>Loading job...</div>;
  }

  return (
    <div>
      <h2>Edit Job</h2>
      <JobForm job={job} onSubmit={handleSubmit} loading={loading} />
    </div>
  );
};

export default EditJob;
