import React, { useEffect, useState } from 'react';

const Jobs: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    // TODO: Fetch jobs from Firestore
    setJobs([
      { id: '1', title: 'Software Engineer', department: 'Engineering', locationType: 'remote' },
      { id: '2', title: 'Product Manager', department: 'Product', locationType: 'hybrid', locationText: 'New York, NY' },
    ]);
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Open Positions</h1>
      <div className="grid gap-4">
        {jobs.map(job => (
          <div key={job.id} className="p-4 border rounded-lg">
            <h2 className="text-xl font-semibold">{job.title}</h2>
            <p>{job.department}</p>
            <p>{job.locationType === 'remote' ? 'Remote' : job.locationText}</p>
            <a href={`/jobs/${job.id}`} className="text-blue-500">View Details</a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Jobs;
