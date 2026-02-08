import React from 'react';

const Status: React.FC = () => {
  return (
    <div>
      <h1>Application Status</h1>
      <p>What happens after you apply</p>
      <ul>
        <li>Your application is received</li>
        <li>A human reads it</li>
        <li>If there’s a next step, we reach out</li>
        <li>If not, your information is respectfully archived</li>
      </ul>
      <p>We do not:</p>
      <ul>
        <li>Auto-reject</li>
        <li>Ghost intentionally</li>
        <li>Share your data</li>
        <li>Rank humans by keyword score</li>
      </ul>
    </div>
  );
};

export default Status;
