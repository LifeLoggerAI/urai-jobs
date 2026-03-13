
import React from 'react';
import { Applicant } from '../../../../packages/types/src/jobs';

interface ApplicantDetailProps {
  applicant: Applicant;
  onBack: () => void;
}

const ApplicantDetail: React.FC<ApplicantDetailProps> = ({ applicant, onBack }) => {
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
      {/* Application list will go here */}
      <p>Application list coming soon...</p>

    </div>
  );
};

export default ApplicantDetail;
