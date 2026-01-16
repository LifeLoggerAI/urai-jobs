import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

function Referral() {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleReferral = async () => {
      const referralRef = doc(db, "referrals", code);
      const referralSnap = await getDoc(referralRef);

      if (referralSnap.exists()) {
        await updateDoc(referralRef, {
          clicksCount: (referralSnap.data().clicksCount || 0) + 1,
        });

        navigate(`/apply/${referralSnap.data().jobId}`);
      } else {
        navigate("/jobs");
      }
    };

    handleReferral();
  }, [code, navigate]);

  return (
    <div>
      <p>Redirecting...</p>
    </div>
  );
}

export default Referral;
