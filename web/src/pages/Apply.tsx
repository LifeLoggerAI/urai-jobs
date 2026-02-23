
import React from 'react';
import { useForm } from 'react-hook-form';
import { useParams, useNavigate } from 'react-router-dom';
import useApplication from '../hooks/useApplication';

interface ApplyFormData {
  name: string;
  primaryEmail: string;
  phone?: string;
  portfolio?: string;
  linkedin?: string;
  github?: string;
  resume: FileList;
}

const Apply: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<ApplyFormData>();
  const { createApplication, loading, error } = useApplication();

  const onSubmit = async (data: ApplyFormData) => {
    const { success } = await createApplication({ ...data, jobId: jobId! });
    if (success) {
      navigate('/apply/success');
    }
  };

  return (
    <div>
      <h1>Apply for Job</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <input {...register('name', { required: true })} placeholder="Name" />
        {errors.name && <span>Name is required</span>}

        <input {...register('primaryEmail', { required: true })} placeholder="Email" />
        {errors.primaryEmail && <span>Email is required</span>}

        <input {...register('phone')} placeholder="Phone" />
        <input {...register('portfolio')} placeholder="Portfolio" />
        <input {...register('linkedin')} placeholder="LinkedIn" />
        <input {...register('github')} placeholder="GitHub" />

        <input type="file" {...register('resume', { required: true })} />
        {errors.resume && <span>Resume is required</span>}

        <button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Application'}
        </button>
        {error && <p>Error: {error.message}</p>}
      </form>
    </div>
  );
};

export default Apply;
