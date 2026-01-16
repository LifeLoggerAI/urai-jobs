import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const Referral = () => {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // TODO: log referral click event
    console.log(`Referral code: ${code}`);
    navigate('/jobs');
  }, [code, navigate]);

  return <div>Redirecting...</div>;
};

export default Referral;
