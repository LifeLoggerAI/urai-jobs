
import React from 'react';
import { useForm } from 'react-hook-form';
import { useParams, useNavigate } from 'react-router-dom';
import useApplication from '../hooks/useApplication';
import useJob from '../hooks/useJob';

// ... (interface remains the same)

const Apply: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { job, loading: jobLoading } = useJob(jobId!);
  const { register, handleSubmit, formState: { errors } } = useForm<ApplyFormData>();
  const { createApplication, loading: appLoading, error } = useApplication();

  const onSubmit = async (data: ApplyFormData) => {
    if (!jobId) return;
    const { success } = await createApplication({ ...data, jobId });
    if (success) {
      navigate('/apply/success');
    }
  };

  if (jobLoading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Loading application form...</div>;
  }

  return (
    <div style={{ maxWidth: '700px', margin: '40px auto', padding: '40px', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>Apply for {job?.title || 'this position'}</h1>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: '40px' }}>We're excited to see your application. Please fill out the form below.</p>
      
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="name" style={{ marginBottom: '8px', fontWeight: 'bold' }}>Full Name</label>
          <input id="name" {...register('name', { required: 'Please enter your full name.' })} placeholder="Jane Doe" style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
          {errors.name && <span style={{ color: 'red', marginTop: '8px' }}>{errors.name.message}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="primaryEmail" style={{ marginBottom: '8px', fontWeight: 'bold' }}>Email Address</label>
          <input id="primaryEmail" type="email" {...register('primaryEmail', { required: 'A valid email is required.' })} placeholder="jane.doe@example.com" style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
          {errors.primaryEmail && <span style={{ color: 'red', marginTop: '8px' }}>{errors.primaryEmail.message}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="phone" style={{ marginBottom: '8px', fontWeight: 'bold' }}>Phone (Optional)</label>
          <input id="phone" {...register('phone')} placeholder="(555) 123-4567" style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="portfolio" style={{ marginBottom: '8px', fontWeight: 'bold' }}>Portfolio/Website (Optional)</label>
          <input id="portfolio" {...register('portfolio')} placeholder="https://your-portfolio.com" style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="linkedin" style={{ marginBottom: '8px', fontWeight: 'bold' }}>LinkedIn Profile (Optional)</label>
          <input id="linkedin" {...register('linkedin')} placeholder="https://linkedin.com/in/yourprofile" style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="github" style={{ marginBottom: '8px', fontWeight: 'bold' }}>GitHub Profile (Optional)</label>
          <input id="github" {...register('github')} placeholder="https://github.com/yourusername" style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="resume" style={{ marginBottom: '8px', fontWeight: 'bold' }}>Your Resume</label>
          <input id="resume" type="file" accept=".pdf,.doc,.docx" {...register('resume', { required: 'Please upload your resume.' })} style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
          {errors.resume && <span style={{ color: 'red', marginTop: '8px' }}>{errors.resume.message}</span>}
          <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '8px' }}>Accepted file types: PDF, DOC, DOCX. Max size: 10MB.</p>
        </div>

        <button type="submit" disabled={appLoading} style={{ padding: '15px', borderRadius: '5px', border: 'none', backgroundColor: '#007bff', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', marginTop: '20px' }}>
          {appLoading ? 'Submitting Application...' : 'Submit Application'}
        </button>
        
        {error && <p style={{ color: 'red', textAlign: 'center', marginTop: '20px' }}>An unexpected error occurred during submission. Please try again. {error.message}</p>}
      </form>
    </div>
  );
};

export default Apply;
