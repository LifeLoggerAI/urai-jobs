import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

interface ApplyForm {
  name: string;
  email: string;
  phone: string;
  portfolio: string;
  linkedin: string;
  github: string;
  other: string;
  answers: Record<string, string>;
}

const Apply: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<ApplyForm>({
    name: '',
    email: '',
    phone: '',
    portfolio: '',
    linkedin: '',
    github: '',
    other: '',
    answers: {},
  });
  const [resume, setResume] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localStorageKey = `application-draft-${jobId}`;

  useEffect(() => {
    if (jobId) {
      const draft = localStorage.getItem(localStorageKey);
      if (draft) {
        setForm(JSON.parse(draft));
      }
    }
  }, [jobId, localStorageKey]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const newForm = { ...form, [name]: value };
    setForm(newForm);
    localStorage.setItem(localStorageKey, JSON.stringify(newForm));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setResume(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!jobId) {
        setError('Job ID is missing.');
        setIsSubmitting(false);
        return;
    }

    try {
      const applicationData = {
        jobId,
        applicantEmail: form.email.toLowerCase(),
        name: form.name,
        phone: form.phone,
        links: {
          portfolio: form.portfolio,
          linkedin: form.linkedin,
          github: form.github,
          other: form.other.split(',').map(s => s.trim()).filter(s => s),
        },
        answers: form.answers,
        submittedAt: serverTimestamp(),
        status: 'NEW',
      };

      const applicationRef = await addDoc(collection(db, 'applications'), applicationData);

      if (resume) {
        const storagePath = `resumes/${applicationRef.id}/${resume.name}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, resume);

        await new Promise<void>((resolve, reject) => {
            uploadTask.on(
                'state_changed',
                null,
                (error) => {
                    console.error('Upload failed:', error);
                    setError('Resume upload failed.');
                    reject(error);
                },
                () => {
                    getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
                        await updateDoc(doc(db, 'applications', applicationRef.id), {
                            resume: {
                                storagePath,
                                filename: resume.name,
                                contentType: resume.type,
                                size: resume.size,
                            }
                        });
                        resolve();
                    }).catch(reject);
                }
            );
        });
      }

      localStorage.removeItem(localStorageKey);
      navigate('/apply/success');
    } catch (err) {
      console.error('Submission failed:', err);
      setError('An error occurred during submission. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2>Apply for {jobId}</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
            <label>Full Name</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
            <label>Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
            <label>Phone (Optional)</label>
            <input type="tel" name="phone" value={form.phone} onChange={handleChange} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
            <label>Portfolio URL</label>
            <input type="url" name="portfolio" value={form.portfolio} onChange={handleChange} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
            <label>LinkedIn URL</label>
            <input type="url" name="linkedin" value={form.linkedin} onChange={handleChange} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
            <label>GitHub URL</label>
            <input type="url" name="github" value={form.github} onChange={handleChange} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
            <label>Other Links (comma-separated)</label>
            <input type="text" name="other" value={form.other} onChange={handleChange} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
            <label>Resume</label>
            <input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={isSubmitting} style={{ padding: '10px 15px', cursor: 'pointer' }}>
          {isSubmitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
};

export default Apply;
