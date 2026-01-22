import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';

const ReferralPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const trackAndRedirect = async () => {
      if (!code) {
        navigate('/jobs');
        return;
      }

      const refRef = doc(db, 'referrals', code);
      const refSnap = await getDoc(refRef);

      if (refSnap.exists() && refSnap.data().active) {
        await updateDoc(refRef, { clicksCount: increment(1) });
        // Store referral code to use during application
        sessionStorage.setItem('referralCode', code);
        navigate('/jobs');
      } else {
        // If referral code is invalid, just redirect to jobs
        navigate('/jobs');
      }
    };

    trackAndRedirect();
  }, [code, navigate]);

  return (
    <div className="container mx-auto p-4 text-center">
      <p>Processing your referral...</p>
    </div>
  );
};

export default ReferralPage;
