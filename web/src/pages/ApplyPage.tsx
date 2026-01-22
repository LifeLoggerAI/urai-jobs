import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, serverTimestamp, writeBatch, collection } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

const ApplyPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [jobTitle, setJobTitle] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    primaryEmail: '',
    phone: '',
    portfolio: '',
    linkedin: '',
    github: '',
    other: '',
    answers: {},
  });
  const [resume, setResume] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const draftKey = `application-draft-${jobId}-${formData.primaryEmail}`;

  useEffect(() => {
    const fetchJobTitle = async () => {
      if (!jobId) return;
      const jobRef = doc(db, 'jobPublic', jobId);
      const jobSnap = await getDoc(jobRef);
      if (jobSnap.exists()) {
        setJobTitle(jobSnap.data().title);
      }
    };
    fetchJobTitle();

    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      setFormData(JSON.parse(savedDraft));
    }

  }, [jobId]);

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify(formData));
  }, [formData, draftKey]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setResume(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId) return;
    setLoading(true);
    setError('');

    try {
      const batch = writeBatch(db);
      const applicantId = formData.primaryEmail.toLowerCase();
      const applicantRef = doc(db, 'applicants', applicantId);

      batch.set(applicantRef, {
        name: formData.name,
        primaryEmail: formData.primaryEmail.toLowerCase(),
        phone: formData.phone,
        links: {
          portfolio: formData.portfolio,
          linkedin: formData.linkedin,
          github: formData.github,
          other: formData.other ? formData.other.split(',') : [],
        },
        source: { type: 'direct' },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
      }, { merge: true });

      const applicationRef = doc(collection(db, 'applications'));
      batch.set(applicationRef, {
        jobId,
        applicantId,
        applicantEmail: formData.primaryEmail.toLowerCase(),
        status: 'NEW',
        answers: formData.answers,
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (resume) {
        const resumeRef = ref(storage, `resumes/${applicantId}/${applicationRef.id}/${resume.name}`);
        await uploadBytes(resumeRef, resume);
        const resumeInfo = {
          storagePath: resumeRef.fullPath,
          filename: resume.name,
          contentType: resume.type,
          size: resume.size,
        };
        batch.update(applicationRef, { resume: resumeInfo });
      }

      await batch.commit();

      localStorage.removeItem(draftKey);
      navigate('/apply/success');

    } catch (err) {
      setError('Failed to submit application. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Apply for {jobTitle}</h1>
      <p className="mb-6">Fields are saved automatically as you type.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="name" value={formData.name} onChange={handleChange} placeholder="Full Name" required className="w-full p-2 border" />
        <input name="primaryEmail" type="email" value={formData.primaryEmail} onChange={handleChange} placeholder="Email" required className="w-full p-2 border" />
        <input name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="Phone (Optional)" className="w-full p-2 border" />
        <h2 className="text-lg font-semibold pt-4">Links</h2>
        <input name="portfolio" value={formData.portfolio} onChange={handleChange} placeholder="Portfolio URL" className="w-full p-2 border" />
        <input name="linkedin" value={formData.linkedin} onChange={handleChange} placeholder="LinkedIn URL" className="w-full p-2 border" />
        <input name="github" value={formData.github} onChange={handleChange} placeholder="GitHub URL" className="w-full p-2 border" />
        <input name="other" value={formData.other} onChange={handleChange} placeholder="Other Links (comma-separated)" className="w-full p-2 border" />
        
        <h2 className="text-lg font-semibold pt-4">Resume</h2>
        <input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx" className="w-full p-2 border" />

        {error && <p className="text-red-500">{error}</p>}

        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400">
          {loading ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
};

export default ApplyPage;
