import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const Apply: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [resume, setResume] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setResume(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resume) {
      setError('Please upload a resume.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(resume);
      reader.onload = async () => {
        const fileContent = reader.result?.toString().split(',')[1];
        if (!fileContent) {
          setError('Error reading file.');
          setLoading(false);
          return;
        }

        const uploadResume = httpsCallable(functions, 'uploadResume');
        await uploadResume({ fileContent, fileName: resume.name });

        const applyForJob = httpsCallable(functions, 'applyForJob');
        await applyForJob({ jobId, coverLetter });

        setSuccess(true);
      };
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (success) {
    return <p>Application submitted successfully!</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Apply for Job</h1>
      <div>
        <label htmlFor="resume">Resume</label>
        <input type="file" id="resume" onChange={handleFileChange} />
      </div>
      <div>
        <label htmlFor="coverLetter">Cover Letter</label>
        <textarea
          id="coverLetter"
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
        />
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Application'}
      </button>
    </form>
  );
};

export default Apply;
