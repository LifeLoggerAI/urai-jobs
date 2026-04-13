import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';

const CreateJobPage = () => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!user) {
      setError('You must be logged in to create a job.');
      return;
    }

    try {
      await addDoc(collection(db, 'jobs'), {
        title,
        description,
        company,
        uid: user.uid,
        createdAt: new Date(),
      });
      setSuccess('Job created successfully!');
      setTitle('');
      setDescription('');
      setCompany('');
    } catch (err) {
      setError('Failed to create job. Please try again.');
      console.error(err);
    }
  };

  return (
    <div>
      <h1>Create Job</h1>
      <form onSubmit={handleCreateJob}>
        <div>
          <label>Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label>Company</label>
          <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} required />
        </div>
        <div>
          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
        <button type="submit">Create Job</button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {success && <p style={{ color: 'green' }}>{success}</p>}
      </form>
    </div>
  );
};

export default CreateJobPage;
