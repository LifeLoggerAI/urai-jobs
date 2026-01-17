import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useEffect, useState } from 'react';

export const useAdmin = () => {
  const [user, loading] = useAuthState(auth);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (user) {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        setIsAdmin(adminDoc.exists());
      }
      setAdminLoading(false);
    };
    if (!loading) {
        checkAdmin();
    }
  }, [user, loading]);

  return { user, isAdmin, loading: loading || adminLoading };
};
