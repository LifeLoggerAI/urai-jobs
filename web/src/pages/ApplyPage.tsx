import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

const ApplyPage = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    portfolio: '',
    linkedin: '',
    github: '',
    other: '',
    answers: {},
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      const jobDocRef = doc(db, 'jobPublic', jobId);
      const jobDoc = await getDoc(jobDocRef);
      if (jobDoc.exists()) {
        setJob({ id: jobDoc.id, ...jobDoc.data() });
      }
    };

    fetchJob();
  }, [jobId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAnswerChange = (question, value) => {
    setFormData({ ...formData, answers: { ...formData.answers, [question]: value } });
  };

  const handleFileChange = (e) => {
    setResumeFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Create Applicant
      const applicantRef = await addDoc(collection(db, 'applicants'), {
        primaryEmail: formData.email.toLowerCase(),
        name: formData.name,
        phone: formData.phone,
        links: {
          portfolio: formData.portfolio,
          linkedin: formData.linkedin,
          github: formData.github,
          other: formData.other.split(',').map(s => s.trim()).filter(s => s),
        },
        source: { type: 'direct' },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
      });

      // 2. Upload Resume (if provided)
      let resumeData = null;
      if (resumeFile) {
        const resumeRef = ref(storage, `resumes/${applicantRef.id}/${jobId}/${resumeFile.name}`);
        const uploadTask = await uploadBytesResumable(resumeRef, resumeFile);
        const downloadURL = await getDownloadURL(uploadTask.ref);
        resumeData = {
          storagePath: uploadTask.ref.fullPath,
          filename: resumeFile.name,
          contentType: resumeFile.type,
          size: resumeFile.size,
          downloadURL
        };
      }

      // 3. Create Application
      await addDoc(collection(db, 'applications'), {
        jobId,
        applicantId: applicantRef.id,
        applicantEmail: formData.email.toLowerCase(),
        status: 'NEW',
        answers: formData.answers,
        resume: resumeData,
        tags: [],
        notesCount: 0,
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 4. Track Event
      await addDoc(collection(db, 'events'), {
        type: 'apply_submit',
        entityType: 'application',
        entityId: applicantRef.id,
        createdAt: serverTimestamp(),
        metadata: { jobId },
      });

      navigate(`/apply/success`);
    } catch (error) {
      console.error("Error submitting application: ", error);
      setIsSubmitting(false);
    }
  };

  if (!job) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Apply for {job.title}</h1>
      <form onSubmit={handleSubmit}>
        {/* ... form fields for name, email, phone, links, etc. ... */}
        {/* ... form fields for job-specific questions ... */}
        <div className="mb-4">
          <label className="block text-gray-700">Resume</label>
          <input type="file" onChange={handleFileChange} />
        </div>
        <button type="submit" disabled={isSubmitting} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
          {isSubmitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
};

export default ApplyPage;
