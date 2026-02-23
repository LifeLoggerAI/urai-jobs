
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import JobForm from '../../components/admin/JobForm';
import { Job } from '../../../types';

const NewJob: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (data: Job) => {
    setLoading(true);
    try {
      await addDoc(collection(db, 'jobs'), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      navigate('/admin/jobs');
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Create New Job</h2>
      <JobForm onSubmit={handleSubmit} loading={loading} />
    </div>
  );
};

export default NewJob;
