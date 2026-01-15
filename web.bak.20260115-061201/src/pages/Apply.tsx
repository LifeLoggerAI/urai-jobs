import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const Apply: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [resume, setResume] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      if (jobId) {
        const docRef = doc(db, 'jobPublic', jobId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setJob({ id: docSnap.id, ...docSnap.data() });
        }
      }
    };
    fetchJob();
  }, [jobId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setResume(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId || !resume) return;

    setUploading(true);

    try {
      const applicationRef = await addDoc(collection(db, 'applications'), {
        jobId,
        applicantEmail: formData.email.toLowerCase(),
        submittedAt: new Date(),
        status: 'NEW',
        answers: { name: formData.name, phone: formData.phone },
      });

      const storageRef = ref(storage, `resumes/${applicationRef.id}/${resume.name}`);
      const uploadTask = uploadBytesResumable(storageRef, resume);

      uploadTask.on('state_changed', 
        (snapshot) => {
          // Observe state change events such as progress, pause, and resume
        },
        (error) => {
          console.error("Upload failed", error);
          setUploading(false);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
            console.log('File available at', downloadURL);
            // Here you would typically update the application document with the resume URL
            // but for this example we just navigate to success.
            setUploading(false);
            navigate('/apply/success');
          });
        }
      );
    } catch (error) {
      console.error("Error submitting application", error);
      setUploading(false);
    }
  };

  if (!job) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Apply for {job.title}</h1>
      <form onSubmit={handleSubmit}>
        <input name="name" placeholder="Full Name" onChange={handleChange} required />
        <input name="email" type="email" placeholder="Email" onChange={handleChange} required />
        <input name="phone" placeholder="Phone (Optional)" onChange={handleChange} />
        <input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx" required />
        <button type="submit" disabled={uploading}>
          {uploading ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
};

export default Apply;
