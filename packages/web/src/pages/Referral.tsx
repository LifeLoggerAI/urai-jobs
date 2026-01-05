import React from 'react';
import { useParams } from 'react-router-dom';

const Referral: React.FC = () => {
  const { code } = useParams<{ code: string }>();

  return (
    <div>
      <h1>Referral</h1>
      <p>Referral Code: {code}</p>
    </div>
  );
};

export default Referral;
