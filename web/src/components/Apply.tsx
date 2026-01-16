import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { db, storage } from "../lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";

function Apply() {
  const { jobId } = useParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [resume, setResume] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const draft = localStorage.getItem(`draft-${jobId}-${email}`);
    if (draft) {
      const { name, email } = JSON.parse(draft);
      setName(name);
      setEmail(email);
    }
  }, [jobId, email]);

  const handleApply = async (e) => {
    e.preventDefault();

    if (!name || !email || !resume) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      const applicationRef = await addDoc(collection(db, "applications"), {
        jobId,
        name,
        email,
        status: "NEW",
        submittedAt: new Date(),
      });

      const resumeRef = ref(
        storage,
        `resumes/${applicationRef.id}/${resume.name}`
      );
      await uploadBytes(resumeRef, resume);

      localStorage.removeItem(`draft-${jobId}-${email}`);
      window.location.href = "/apply/success";
    } catch (error) {
      setError(error.message);
    }
  };

  const handleSaveDraft = () => {
    const draft = JSON.stringify({ name, email });
    localStorage.setItem(`draft-${jobId}-${email}`, draft);
  };

  return (
    <div>
      <h1>Apply for Job</h1>
      {error && <p>{error}</p>}
      <form onSubmit={handleApply}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input type="file" onChange={(e) => setResume(e.target.files[0])} />
        <button type="submit">Submit</button>
      </form>
      <button onClick={handleSaveDraft}>Save Draft</button>
    </div>
  );
}

export default Apply;
