import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listJobs } from "../lib/jobs";
import type { Job } from "../types/Job";

export default function JobBoard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function run() {
      try {
        setLoading(true);
        setError("");
        const data = await listJobs();
        setJobs(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load jobs");
      } finally {
        setLoading(false);
      }
    }

    void run();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1>Jobs</h1>
      {jobs.length === 0 ? (
        <p>No jobs found.</p>
      ) : (
        <ul>
          {jobs.map((job) => (
            <li key={job.id}>
              <Link to={`/jobs/${job.id}`}>{job.title}</Link> — {job.company}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
