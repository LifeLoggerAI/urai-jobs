import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const JobDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<any | null>(null);

  useEffect(() => {
    // TODO: Fetch job details from Firestore
    setJob({
      id: jobId,
      title: 'Software Engineer',
      department: 'Engineering',
      locationType: 'remote',
      descriptionMarkdown: 'This is a role for a software engineer.',
      requirements: ['React', 'TypeScript', 'Node.js'],
      niceToHave: ['Firebase', 'GraphQL'],
      compensationRange: { min: 100000, max: 150000, currency: 'USD' },
    });
  }, [jobId]);

  if (!job) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-2">{job.title}</h1>
      <p className="text-lg mb-4">{job.department}</p>
      <a href={`/apply/${job.id}`} className="bg-blue-500 text-white px-4 py-2 rounded-lg">Apply Now</a>
      <div className="mt-8">
        <h2 className="text-2xl font-semibold">Description</h2>
        <p>{job.descriptionMarkdown}</p>
      </div>
      <div className="mt-8">
        <h2 className="text-2xl font-semibold">Requirements</h2>
        <ul className="list-disc list-inside">
          {job.requirements.map((req: string) => <li key={req}>{req}</li>)}
        </ul>
      </div>
      <div className="mt-8">
        <h2 className="text-2xl font-semibold">Nice to Have</h2>
        <ul className="list-disc list-inside">
          {job.niceToHave.map((req: string) => <li key={req}>{req}</li>)}
        </ul>
      </div>
      <div className="mt-8">
        <h2 className="text-2xl font-semibold">Compensation</h2>
        <p>${job.compensationRange.min} - ${job.compensationRange.max} {job.compensationRange.currency}</p>
      </div>
    </div>
  );
};

export default JobDetail;
