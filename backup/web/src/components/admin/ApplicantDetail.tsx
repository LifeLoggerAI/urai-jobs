
import React from 'react';
import { Applicant, Application } from '../../../../packages/types/src/jobs';
import useApplications from '../../hooks/useApplications';

interface ApplicantDetailProps {
  applicant: Applicant;
  onBack: () => void;
}

const ApplicantDetail: React.FC<ApplicantDetailProps> = ({ applicant, onBack }) => {
  const { applications, loading, error } = useApplications(applicant.id);

  return (
    <div>
      <button onClick={onBack} style={{ marginBottom: '20px' }}>&larr; Back to Applicants</button>
      <h2>{applicant.name}</h2>
      <p><strong>Email:</strong> {applicant.primaryEmail}</p>
      {applicant.phone && <p><strong>Phone:</strong> {applicant.phone}</p>}
      {applicant.links && (
        <div>
          <strong>Links:</strong>
          <ul>
            {applicant.links.linkedin && <li><a href={applicant.links.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a></li>}
            {applicant.links.github && <li><a href={applicant.links.github} target="_blank" rel="noopener noreferrer">GitHub</a></li>}
            {applicant.links.portfolio && <li><a href={applicant.links.portfolio} target="_blank" rel="noopener noreferrer">Portfolio</a></li>}
          </ul>
        </div>
      )}

      <hr style={{ margin: '30px 0' }} />

      <h3>Applications</h3>
      {loading && <p>Loading applications...</p>}
      {error && <p style={{ color: 'red' }}>Error loading applications: {error.message}</p>}
      {!loading && !error && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>Job Title</th>
              <th style={{ padding: '12px' }}>Status</th>
              <th style={{ padding: '12px' }}>Submitted At</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr key={app.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px' }}>{app.jobId}</td> 
                <td style={{ padding: '12px' }}><span style={{ background: '#eee', padding: '4px 8px', borderRadius: '4px' }}>{app.status}</span></td>
                <td style={{ padding: '12px' }}>{app.submittedAt?.toDate().toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ApplicantDetail;
