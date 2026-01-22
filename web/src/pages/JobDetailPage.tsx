import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Job {
  title: string;
  department: string;
  locationType: string;
  locationText: string;
  employmentType: string;
  descriptionMarkdown: string;
  requirements: string[];
  niceToHave: string[];
}

const JobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      if (!jobId) return;
      const jobRef = doc(db, 'jobPublic', jobId);
      const jobSnap = await getDoc(jobRef);
      if (jobSnap.exists()) {
        setJob(jobSnap.data() as Job);
      } else {
        // Handle job not found
      }
      setLoading(false);
    };

    fetchJob();
  }, [jobId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!job) {
    return <div>Job not found</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Link to="/jobs" className="text-blue-600 hover:underline">&larr; Back to all jobs</Link>
      <h1 className="text-3xl font-bold my-4">{job.title}</h1>
      <div className="flex flex-wrap gap-4 text-gray-600 mb-6">
        <span>{job.department}</span>
        <span>&bull;</span>
        <span>{job.locationType} - {job.locationText}</span>
        <span>&bull;</span>
        <span>{job.employmentType.replace('_', ' ')}</span>
      </div>
      
      <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: job.descriptionMarkdown }} />

      <h2 className="text-2xl font-bold mt-8 mb-4">Requirements</h2>
      <ul className="list-disc list-inside space-y-2">
        {job.requirements.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
      
      <h2 className="text-2xl font-bold mt-8 mb-4">Nice to Have</h2>
      <ul className="list-disc list-inside space-y-2">
        {job.niceToHave.map((item, index) => <li key={index}>{item}</li>)}
      </ul>

      <div className="mt-12">
        <Link to={`/apply/${jobId}`} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700">
          Apply Now
        </Link>
      </div>
    </div>
  );
};

export default JobDetailPage;
