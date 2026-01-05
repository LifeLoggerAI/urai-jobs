import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const ReferralPage = () => {
  const { code } = useParams<{ code: string }>();
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

      if (!refDoc.exists() || !refDoc.data()?.active) {
        console.warn(`Invalid or inactive referral code: ${code}`);
        navigate('/jobs?error=invalid_ref');
        return;
      }

      // 2. Track the click event
      try {
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

        // 3. Increment clicks count
        await updateDoc(refDocRef, {
            clicksCount: increment(1)
        });
      } catch (error) {
          console.error("Error tracking referral click:", error);
      }

      // 4. Store referral code in session storage to be picked up on application
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
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
            <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-24 w-24 mb-4"></div>
            <h1 className="text-2xl font-bold text-gray-700">Processing your referral...</h1>
            <p className="text-gray-500">Please wait while we redirect you.</p>
        </div>
        <style>{`
            .loader {
                border-top-color: #3498db;
                animation: spinner 1.5s linear infinite;
            }
            @keyframes spinner {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `}</style>
    </div>
  );
};

export default ReferralPage;
