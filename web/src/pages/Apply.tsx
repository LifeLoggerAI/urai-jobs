import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { submitApplication } from "../lib/applications";
import { useAuth } from "../context/AuthContext";

export default function Apply() {
  const { jobId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in to apply.");
      return;
    }
    if (!jobId) {
      setError("Missing job id.");
      return;
    }
    if (!resumeFile) {
      setError("Please attach a resume.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await submitApplication({
        userId: user.uid,
        jobId,
        file: resumeFile,
      });
      navigate(`/jobs/${jobId}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Application submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Apply</h1>
      {error ? <p role="alert">{error}</p> : null}
      <label htmlFor="resume">Resume</label>
      <input
        id="resume"
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
        required
      />
      <button type="submit" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
}
