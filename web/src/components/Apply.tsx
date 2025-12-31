import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';

const Apply = () => {
  const { jobId } = useParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [resume, setResume] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Create application in Firestore
    const applicationRef = await addDoc(collection(db, 'applications'), {
      jobId,
      applicantEmail: email,
      name,
      status: 'NEW',
      submittedAt: new Date(),
    });

    // 2. Upload resume to Storage
    if (resume) {
      const resumeRef = ref(storage, `resumes/${applicationRef.id}/${resume.name}`);
      await uploadBytes(resumeRef, resume);
    }

    // 3. Redirect to a confirmation page
    alert('Application submitted!');
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Apply for Job</h2>
      <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="file" onChange={(e) => setResume(e.target.files[0])} />
      <button type="submit">Submit Application</button>
    </form>
  );
};

export default Apply;
