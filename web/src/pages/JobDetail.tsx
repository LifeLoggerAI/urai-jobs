import React from "react";
import { useParams, Link } from "react-router-dom";
import { useJob } from "../hooks/useJob";

const JobDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { job, loading } = useJob(jobId!);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!job) {
    return <div>Job not found</div>;
  }

  return (
    <div>
      <h1>{job.title}</h1>
      <p>
        {job.department} - {job.locationText}
      </p>
      <p>{job.descriptionMarkdown}</p>
      <h2>Requirements</h2>
      <ul>
        {job.requirements.map((requirement, index) => (
          <li key={index}>{requirement}</li>
        ))}
      </ul>
      <h2>Nice to Have</h2>
      <ul>
        {job.niceToHave.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
      {job.compensationRange && (
        <div>
          <h2>Compensation</h2>
          <p>
            {job.compensationRange.min} - {job.compensationRange.max} {job.compensationRange.currency}
          </p>
        </div>
      )}
      <Link to={`/apply/${job.id}`}>Apply Now</Link>
    </div>
  );
};

export default JobDetail;
