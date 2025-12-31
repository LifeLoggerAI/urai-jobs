import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, Link } from 'react-router-dom';

const JobDetailPage = () => {
  const [job, setJob] = useState(null);
  const { jobId } = useParams();

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

  if (!job) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-2">{job.title}</h1>
      <p className="text-gray-600 mb-4">{job.department} - {job.locationText}</p>
      <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: job.descriptionMarkdown }} />
      <Link to={`/apply/${jobId}`} className="bg-blue-500 text-white px-4 py-2 rounded-lg mt-4 inline-block hover:bg-blue-600">Apply Now</Link>
    </div>
  );
};

export default JobDetailPage;
