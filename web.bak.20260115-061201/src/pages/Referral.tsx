import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const Referral: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    // Here you would typically record the referral click event
    console.log(`Referral code used: ${code}`);
    // Redirect to the job list, or a specific job if the code is linked to one
    navigate('/jobs');
  }, [code, navigate]);

  return <div>Loading referral...</div>;
};

export default Referral;
