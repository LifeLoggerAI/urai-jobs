import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, serverTimestamp, DocumentData } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

interface Job extends DocumentData {
  id: string;
  title: string;
  // Add other job fields as necessary
}

interface ApplicationFormData {
  name: string;
  email: string;
  phone: string;
  portfolio: string;
  linkedin: string;
  github: string;
  other: string;
  answers: { [key: string]: string };
}

const ApplyPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [formData, setFormData] = useState<ApplicationFormData>({
    name: '',
    email: '',
    phone: '',
    portfolio: '',
    linkedin: '',
    github: '',
    other: '',
    answers: {},
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      if (jobId) {
        const jobDocRef = doc(db, 'jobPublic', jobId);
        const jobDoc = await getDoc(jobDocRef);
        if (jobDoc.exists()) {
          setJob({ id: jobDoc.id, ...jobDoc.data() } as Job);
        }
      }
    };

    fetchJob();
  }, [jobId]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAnswerChange = (question: string, value: string) => {
    setFormData({ ...formData, answers: { ...formData.answers, [question]: value } });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setResumeFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!jobId) return;
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
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-4">Apply for {job.title}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
          <input type="text" name="name" id="name" required value={formData.name} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
          <input type="email" name="email" id="email" required value={formData.email} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
          <input type="tel" name="phone" id="phone" value={formData.phone} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <hr />
        <h2 className="text-xl font-semibold">Links</h2>
        <div>
          <label htmlFor="portfolio" className="block text-sm font-medium text-gray-700">Portfolio URL</label>
          <input type="url" name="portfolio" id="portfolio" value={formData.portfolio} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="linkedin" className="block text-sm font-medium text-gray-700">LinkedIn URL</label>
          <input type="url" name="linkedin" id="linkedin" value={formData.linkedin} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="github" className="block text-sm font-medium text-gray-700">GitHub URL</label>
          <input type="url" name="github" id="github" value={formData.github} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label htmlFor="other" className="block text-sm font-medium text-gray-700">Other Links (comma separated)</label>
          <input type="text" name="other" id="other" value={formData.other} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <hr />
        <h2 className="text-xl font-semibold">Application Questions</h2>
        {/* Example of a question. In a real app, these would come from the job data */}
        <div>
            <label htmlFor="question1" className="block text-sm font-medium text-gray-700">Why are you interested in this role?</label>
            <textarea id="question1" name="question1" rows={4} onChange={(e) => handleAnswerChange('interest', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        </div>
        <hr />
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Resume/CV</label>
          <input type="file" onChange={handleFileChange} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100" />
        </div>
        <div className="pt-4">
        <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400">
          {isSubmitting ? 'Submitting...' : 'Submit Application'}
        </button>
        </div>
      </form>
    </div>
  );
};

export default ApplyPage;
