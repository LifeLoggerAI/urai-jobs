
import { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface WaitlistData {
  name?: string;
  email: string;
  interests: string[];
}

const useWaitlist = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const joinWaitlist = async (data: WaitlistData) => {
    setLoading(true);
    setError(null);

    try {
      await addDoc(collection(db, 'waitlist'), {
        ...data,
        email: data.email.toLowerCase(),
        consent: { terms: true, marketing: false }, // Assuming default consent
        createdAt: serverTimestamp(),
      });

      setLoading(false);
      return { success: true };
    } catch (err) {
      setError(err as Error);
      setLoading(false);
      return { success: false };
    }
  };

  return { joinWaitlist, loading, error };
};

export default useWaitlist;
