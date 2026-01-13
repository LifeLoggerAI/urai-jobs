import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const Referral: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    // TODO: Track referral click
    console.log(`Referral code: ${code}`);
    const timeoutId = setTimeout(() => {
      navigate('/jobs');
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [code, navigate]);

  return (
    <div className="container mx-auto p-4 text-center">
      <h1 className="text-2xl font-bold mb-4">You've been referred!</h1>
      <p>Redirecting you to the job board...</p>
    </div>
  );
};

export default Referral;
