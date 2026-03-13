
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';

const useReferral = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const processReferral = async () => {
      try {
        const docRef = doc(db, 'referrals', code!);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          await updateDoc(docRef, {
            clicksCount: increment(1),
          });
          // Redirect to a default job or a specific job if specified in referral data
          navigate('/jobs');
        } else {
          setError(new Error('Invalid referral code'));
        }
      } catch (err) {
        setError(err as Error);
      }
      setLoading(false);
    };

    processReferral();
  }, [code, navigate]);

  return { loading, error };
};

export default useReferral;
