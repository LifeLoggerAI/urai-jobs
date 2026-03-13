
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import useJob from '../hooks/useJob';

const JobDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { job, loading, error } = useJob(jobId!);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Loading job details...</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>There was an error loading the job details. Please try again later.</div>;
  }

  if (!job) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>This job opening could not be found.</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/jobs"> &larr; Back to Job Board</Link>
      </div>
      <div style={{ border: '1px solid #eee', borderRadius: '8px', padding: '30px' }}>
        <h1 style={{ marginTop: 0, marginBottom: '10px' }}>{job.title}</h1>
        <p style={{ color: '#555', fontSize: '1.1rem' }}>{job.department} | {job.locationType} | {job.employmentType}</p>
        <hr style={{ margin: '30px 0' }} />
        <div dangerouslySetInnerHTML={{ __html: job.descriptionMarkdown }} />
        <h2 style={{ marginTop: '40px' }}>Requirements</h2>
        <ul style={{ listStyle: 'disc inside', paddingLeft: '20px' }}>
          {job.requirements.map((req, index) => <li key={index} style={{ marginBottom: '10px' }}>{req}</li>)}
        </ul>
        <h2 style={{ marginTop: '40px' }}>Nice to Have</h2>
        <ul style={{ listStyle: 'disc inside', paddingLeft: '20px' }}>
          {job.niceToHave.map((req, index) => <li key={index} style={{ marginBottom: '10px' }}>{req}</li>)}
        </ul>
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <Link to={`/apply/${job.id}`} className="button" style={{ display: 'inline-block', padding: '15px 30px', backgroundColor: '#007bff', color: '#fff', textDecoration: 'none', borderRadius: '5px', fontSize: '1.2rem' }}>Apply Now</Link>
        </div>
      </div>
    </div>
  );
};

export default JobDetail;
