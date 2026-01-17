import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const Referral: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const logReferral = async () => {
        if (code) {
            try {
                await addDoc(collection(db, 'events'), {
                    type: 'referral_click',
                    entityType: 'referral',
                    entityId: code,
                    createdAt: serverTimestamp(),
                    metadata: {
                        userAgent: navigator.userAgent,
                    }
                });
            } catch (error) {
                console.error("Failed to log referral click:", error);
            }
        }
        // Store referral code to use during application
        if (code) {
            sessionStorage.setItem('referralCode', code);
        }
        navigate('/jobs');
    };

    logReferral();
  }, [code, navigate]);

  return <div>Redirecting...</div>;
};

export default Referral;
