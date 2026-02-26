
import React, { useState } from 'react';
import useJobs from '../../hooks/useJobs';
import { Job } from '../../../../packages/types/src/jobs';
import JobForm from './JobForm'; // Import the JobForm component

const JobList: React.FC = () => {
  const { jobs, loading, error, addJob, updateJob, deleteJob } = useJobs();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const openModal = (job: Job | null = null) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedJob(null);
  };

  const handleSaveJob = async (data: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (selectedJob) {
      await updateJob(selectedJob.id, data);
    } else {
      await addJob(data);
    }
    closeModal();
  };

  const handleDeleteJob = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this job?')) {
      await deleteJob(id);
    }
  };


  if (loading) return <p>Loading jobs...</p>;
  if (error) return <p style={{ color: 'red' }}>Error loading jobs: {error.message}</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2>Job Listings</h2>
        <button onClick={() => openModal()} style={{ padding: '10px 15px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          + Create New Job
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>
            <th style={{ padding: '12px' }}>Title</th>
            <th style={{ padding: '12px' }}>Status</th>
            <th style={{ padding: '12px' }}>Created At</th>
            <th style={{ padding: '12px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px' }}>{job.title}</td>
              <td style={{ padding: '12px' }}><span style={{ background: '#eee', padding: '4px 8px', borderRadius: '4px' }}>{job.status}</span></td>
              <td style={{ padding: '12px' }}>{job.createdAt?.toDate().toLocaleDateString()}</td>
              <td style={{ padding: '12px' }}>
                <button onClick={() => openModal(job)} style={{ marginRight: '10px' }}>Edit</button>
                <button onClick={() => handleDeleteJob(job.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && (
        <JobForm 
          job={selectedJob}
          onSave={handleSaveJob}
          onClose={closeModal}
        />
      )}
    </div>
  );
};

export default JobList;
