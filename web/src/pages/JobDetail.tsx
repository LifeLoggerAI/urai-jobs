import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { db, auth } from "../firebase";
import { getJob } from "../lib/jobs";
import type { Job } from "../types/Job";

const JobDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchJob() {
      if (!jobId) {
        setLoading(false);
        setError("Job ID is missing.");
        return;
      }
      try {
        setLoading(true);
        setError("");
        const jobData = await getJob(jobId);
        if (jobData) {
          setJob(jobData);
          const user = auth.currentUser;
          if (user && user.uid === jobData.ownerUid) {
            setIsOwner(true);
          }
        } else {
          setError("Job not found.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load job details.");
      } finally {
        setLoading(false);
      }
    }

    fetchJob();
  }, [jobId]);

  if (loading) {
    return <p>Loading job details...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (!job) {
    return <p>Job not found</p>;
  }

  return (
    <div>
      <h1>{job.title}</h1>
      <h2>{job.company}</h2>
      <p>{job.description}</p>
      {isOwner ? (
        <p>You are the owner of this job posting.</p>
      ) : (
        <Link to={`/jobs/${job.id}/apply`}>Apply Now</Link>
      )}
    </div>
  );
};

export default JobDetail;
