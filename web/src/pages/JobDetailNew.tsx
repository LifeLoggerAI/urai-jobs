import React from 'react';
import { useParams } from 'react-router-dom';

const JobDetailNew: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();

  return (
    <div>
      {/* This will be fetched from Firestore */}
      <h1>Senior Frontend Engineer (Life-Map Systems)</h1>
      <p>Job ID: {jobId}</p>

      <h2>Why this role exists</h2>
      <p>
        This role exists because URAI is building interfaces that represent
        human memory and emotional states. We need someone who treats UI as
        meaning, not decoration.
      </p>

      <h2>What you won’t be asked to do</h2>
      <ul>
        <li>Work nights or weekends</li>
        <li>Chase arbitrary deadlines</li>
      </ul>

      <h2>How we work</h2>
      <ul>
        <li>Async by default</li>
        <li>Written thinking {'>'} meetings</li>
        <li>Calm over urgency</li>
        <li>Depth over speed</li>
      </ul>
    </div>
  );
};

export default JobDetailNew;
