import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface CreateJobFormProps {
  onBack: () => void;
}

const CreateJobForm: React.FC<CreateJobFormProps> = ({ onBack }) => {
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    locationType: 'remote',
    locationText: '',
    employmentType: 'full_time',
    descriptionMarkdown: '',
    requirements: '',
    niceToHave: '',
    status: 'draft',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await addDoc(collection(db, 'jobs'), {
        ...formData,
        requirements: formData.requirements.split('\n').filter(Boolean),
        niceToHave: formData.niceToHave.split('\n').filter(Boolean),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onBack(); // Go back to the dashboard after successful creation
    } catch (err) {
      setError('Failed to create job. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-blue-600 hover:underline">&larr; Back to Dashboard</button>
      <h1 className="text-2xl font-bold mb-4">Create New Job</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="title" value={formData.title} onChange={handleChange} placeholder="Job Title" required className="w-full p-2 border" />
        <input name="department" value={formData.department} onChange={handleChange} placeholder="Department" required className="w-full p-2 border" />
        <select name="locationType" value={formData.locationType} onChange={handleChange} className="w-full p-2 border">
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">On-site</option>
        </select>
        <input name="locationText" value={formData.locationText} onChange={handleChange} placeholder="Location (e.g., San Francisco, CA)" required className="w-full p-2 border" />
        <select name="employmentType" value={formData.employmentType} onChange={handleChange} className="w-full p-2 border">
          <option value="full_time">Full-time</option>
          <option value="part_time">Part-time</option>
          <option value="contract">Contract</option>
          <option value="intern">Intern</option>
        </select>
        <textarea name="descriptionMarkdown" value={formData.descriptionMarkdown} onChange={handleChange} placeholder="Job Description (Markdown supported)" rows={10} required className="w-full p-2 border" />
        <textarea name="requirements" value={formData.requirements} onChange={handleChange} placeholder="Requirements (one per line)" rows={5} required className="w-full p-2 border" />
        <textarea name="niceToHave" value={formData.niceToHave} onChange={handleChange} placeholder="Nice to Have (one per line)" rows={5} className="w-full p-2 border" />
        <select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border">
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="paused">Paused</option>
          <option value="closed">Closed</option>
        </select>

        {error && <p className="text-red-500">{error}</p>}

        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400">
          {loading ? 'Creating...' : 'Create Job'}
        </button>
      </form>
    </div>
  );
};

export default CreateJobForm;
