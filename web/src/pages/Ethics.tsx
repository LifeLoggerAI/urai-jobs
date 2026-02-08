import React from 'react';

const Ethics: React.FC = () => {
  return (
    <div>
      <h1>Hiring Ethics & Data Handling</h1>
      <h2>Our hiring principles</h2>
      <ul>
        <li>We respect applicant time</li>
        <li>We minimize data collection</li>
        <li>We do not sell applicant data</li>
        <li>We do not profile candidates without consent</li>
        <li>We do not use AI to make hiring decisions</li>
      </ul>
      <h2>Data handling</h2>
      <p>
        Applicant data is stored securely in Firebase. Access is limited to
        hiring reviewers. Data can be deleted upon request.
      </p>
      <h2>Consent</h2>
      <p>
        By applying, you consent to us reviewing your information solely for
        hiring purposes.
      </p>
    </div>
  );
};

export default Ethics;
