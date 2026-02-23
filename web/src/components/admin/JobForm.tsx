
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Job } from '../../../types';

interface JobFormProps {
  job?: Job;
  onSubmit: (data: Job) => void;
  loading: boolean;
}

const JobForm: React.FC<JobFormProps> = ({ job, onSubmit, loading }) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Job>();

  useEffect(() => {
    if (job) {
      reset(job);
    }
  }, [job, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('title', { required: true })} placeholder="Job Title" />
      {errors.title && <span>Title is required</span>}

      <select {...register('status', { required: true })}>
        <option value="draft">Draft</option>
        <option value="open">Open</option>
        <option value="paused">Paused</option>
        <option value="closed">Closed</option>
      </select>

      <textarea {...register('descriptionMarkdown', { required: true })} placeholder="Description (Markdown)" />

      <button type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Save Job'}
      </button>
    </form>
  );
};

export default JobForm;
