import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

function Job() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);

  useEffect(() => {
    const fetchJob = async () => {
      const docRef = doc(db, "jobPublic", jobId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setJob(docSnap.data());
      }
    };

    fetchJob();
  }, [jobId]);

  return (
    <div>
      {job ? (
        <>
          <h1>{job.title}</h1>
          <p>{job.descriptionMarkdown}</p>
          <Link to={`/apply/${jobId}`}>Apply</Link>
        </>
      ) : (
        <p>Job not found</p>
      )}
    </div>
  );
}

export default Job;
