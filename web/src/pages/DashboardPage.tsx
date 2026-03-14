import React, { useEffect, useState } from 'react';
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "../firebase";

const DashboardPage = () => {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUser(user);
        const userDocRef = doc(firestore, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUserType(userDoc.data().userType);
        }
      } else {
        setUser(null);
        setUserType(null);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  return (
    <div>
      <h1>Dashboard</h1>
      {userType === 'candidate' && <h2>Candidate Dashboard</h2>}
      {userType === 'employer' && <h2>Employer Dashboard</h2>}
    </div>
  );
};

export default DashboardPage;
