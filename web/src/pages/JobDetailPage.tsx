import { useEffect, useState } from 'react';
import { doc, getDoc, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, Link } from 'react-router-dom';

interface Job extends DocumentData {
  id: string;
  title: string;
  department: string;
  locationText: string;
  descriptionMarkdown: string;
}

const JobDetailPage = () => {
  const [job, setJob] = useState<Job | null>(null);
  const { jobId } = useParams<{ jobId: string }>();

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

  if (!job) {
    return <div className="flex justify-center items-center h-screen"><div>Loading...</div></div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-4xl font-extrabold mb-2 text-gray-800">{job.title}</h1>
        <p className="text-xl text-gray-600 mb-6">{job.department} - {job.locationText}</p>
        <div className="prose max-w-none prose-lg text-gray-700" dangerouslySetInnerHTML={{ __html: job.descriptionMarkdown }} />
        <div className="mt-8 text-center">
          <Link to={`/apply/${jobId}`} className="bg-blue-600 text-white font-bold px-8 py-4 rounded-full text-lg inline-block hover:bg-blue-700 transition-colors duration-300 shadow-md">Apply Now</Link>
        </div>
      </div>
    </div>
  );
};

export default JobDetailPage;
