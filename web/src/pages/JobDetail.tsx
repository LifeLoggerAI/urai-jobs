
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import useJob from '../hooks/useJob';

const JobDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { job, loading, error } = useJob(jobId!);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!job) {
    return <div>Job not found</div>;
  }

  return (
    <div>
      <h1>{job.title}</h1>
      <p>{job.department} - {job.locationType}</p>
      <div dangerouslySetInnerHTML={{ __html: job.descriptionMarkdown }} />
      <h2>Requirements</h2>
      <ul>
        {job.requirements.map((req, index) => <li key={index}>{req}</li>)}
      </ul>
      <h2>Nice to Have</h2>
      <ul>
        {job.niceToHave.map((req, index) => <li key={index}>{req}</li>)}
      </ul>
      <Link to={`/apply/${job.id}`}>Apply Now</Link>
    </div>
  );
};

export default JobDetail;
