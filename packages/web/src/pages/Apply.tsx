import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const Apply: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    portfolio: '',
    linkedin: '',
    github: '',
    other: '',
    resume: null as File | null,
  });

  useEffect(() => {
    const draft = localStorage.getItem(`draft-${jobId}-${formData.email}`);
    if (draft) {
      setFormData(JSON.parse(draft));
    }
  }, [jobId, formData.email]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({ ...prev, resume: file }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Handle form submission
    console.log(formData);
    localStorage.removeItem(`draft-${jobId}-${formData.email}`);
    window.location.href = '/apply/success';
  };

  useEffect(() => {
    if (formData.email) {
      localStorage.setItem(`draft-${jobId}-${formData.email}`, JSON.stringify(formData));
    }
  }, [formData, jobId]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Apply for Software Engineer</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name">Full Name</label>
          <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded-lg" required />
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded-lg" required />
        </div>
        <div>
          <label htmlFor="phone">Phone (Optional)</label>
          <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} className="w-full p-2 border rounded-lg" />
        </div>
        <div>
          <label htmlFor="resume">Resume (PDF, DOC, DOCX)</label>
          <input type="file" id="resume" name="resume" onChange={handleFileChange} className="w-full p-2 border rounded-lg" accept=".pdf,.doc,.docx" required />
        </div>
        <div>
          <label htmlFor="portfolio">Portfolio/Website</label>
          <input type="url" id="portfolio" name="portfolio" value={formData.portfolio} onChange={handleChange} className="w-full p-2 border rounded-lg" />
        </div>
        <div>
          <label htmlFor="linkedin">LinkedIn Profile</label>
          <input type="url" id="linkedin" name="linkedin" value={formData.linkedin} onChange={handleChange} className="w-full p-2 border rounded-lg" />
        </div>
        <div>
          <label htmlFor="github">GitHub Profile</label>
          <input type="url" id="github" name="github" value={formData.github} onChange={handleChange} className="w-full p-2 border rounded-lg" />
        </div>
        <div>
          <label htmlFor="other">Other Links</label>
          <textarea id="other" name="other" value={formData.other} onChange={handleChange} className="w-full p-2 border rounded-lg"></textarea>
        </div>
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-lg">Submit Application</button>
      </form>
    </div>
  );
};

export default Apply;
