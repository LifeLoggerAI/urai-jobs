import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import { useParams, Link } from 'react-router-dom';

interface Job {
  id: string;
  title: string;
  department: string;
  locationType: 'remote' | 'hybrid' | 'onsite';
  locationText: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  descriptionMarkdown: string;
  requirements: string[];
  niceToHave: string[];
  compensationRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
}

const JobDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJob = async () => {
      if (!jobId) {
        setError('Job ID is missing.');
        setLoading(false);
        return;
      }
      try {
        const jobDocRef = doc(firestore, 'jobPublic', jobId);
        const jobDoc = await getDoc(jobDocRef);

        if (jobDoc.exists()) {
          setJob({ id: jobDoc.id, ...jobDoc.data() } as Job);
        } else {
          setError('Job not found.');
        }
      } catch (err) {
        setError('Failed to fetch job details. Please try again later.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [jobId]);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {job && (
        <article>
          <h1 style={{ marginBottom: '0.5rem' }}>{job.title}</h1>
          <p style={{ marginTop: 0, color: '#555' }}>
            {job.department} &middot; {job.locationType} ({job.locationText}) &middot; {job.employmentType}
          </p>
          <Link 
            to={`/apply/${job.id}`}
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#007bff',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              margin: '1.5rem 0'
            }}
          >
            Apply Now
          </Link>
          
          <div dangerouslySetInnerHTML={{ __html: job.descriptionMarkdown.replace(/\n/g, '<br />') }} />

          <h2 style={{ marginTop: '2rem' }}>Requirements</h2>
          <ul>
            {job.requirements.map((req, index) => <li key={index}>{req}</li>)}
          </ul>

          {job.niceToHave && job.niceToHave.length > 0 && (
            <>
              <h2 style={{ marginTop: '2rem' }}>Nice to Have</h2>
              <ul>
                {job.niceToHave.map((req, index) => <li key={index}>{req}</li>)}
              </ul>
            </>
          )}

          {job.compensationRange && (
            <>
              <h2 style={{ marginTop: '2rem' }}>Compensation</h2>
              <p>
                {job.compensationRange.min && `$${job.compensationRange.min}`}{job.compensationRange.max && ` - $${job.compensationRange.max}`}{job.compensationRange.currency && ` ${job.compensationRange.currency}`}
              </p>
            </>
          )}

        </article>
      )}
    </div>
  );
};

export default JobDetail;
