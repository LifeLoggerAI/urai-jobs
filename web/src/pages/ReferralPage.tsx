import React, { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const ReferralPage = () => {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const processReferral = async () => {
      if (!code) {
        navigate('/jobs');
        return;
      }

      // 1. Validate the referral code
      const refDocRef = doc(db, 'referrals', code);
      const refDoc = await getDoc(refDocRef);

      if (!refDoc.exists() || !refDoc.data().active) {
        console.warn(`Invalid or inactive referral code: ${code}`);
        navigate('/jobs');
        return;
      }

      // 2. Track the click event
      await addDoc(collection(db, 'events'), {
        type: 'referral_click',
        entityType: 'referral',
        entityId: code,
        createdAt: serverTimestamp(),
        metadata: {
            jobId: searchParams.get('jobId') || null,
            userAgent: navigator.userAgent,
        },
      });

      // 3. Increment clicks count (could also be done in a function)
      await updateDoc(refDocRef, {
          clicksCount: increment(1)
      });

      // 4. Store referral code in session/local storage to be picked up on application
      sessionStorage.setItem('referralCode', code);

      // 5. Redirect to the appropriate job or the main jobs page
      const jobId = searchParams.get('jobId');
      if (jobId) {
        navigate(`/apply/${jobId}`);
      } else {
        navigate('/jobs');
      }
    };

    processReferral();
  }, [code, navigate, searchParams]);

  return (
    <div className="container mx-auto p-4 text-center">
      <h1 className="text-2xl font-bold">Processing your referral...</h1>
      <p>Please wait while we redirect you.</p>
    </div>
  );
};

export default ReferralPage;
