
import React from 'react';
import { useForm } from 'react-hook-form';
import useWaitlist from '../hooks/useWaitlist';

interface WaitlistFormData {
  name?: string;
  email: string;
  interests: string;
}

const Waitlist: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<WaitlistFormData>();
  const { joinWaitlist, loading, error } = useWaitlist();
  const [submitted, setSubmitted] = React.useState(false);

  const onSubmit = async (data: WaitlistFormData) => {
    const { success } = await joinWaitlist({ ...data, interests: data.interests.split(',').map(s => s.trim()) });
    if (success) {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', padding: '50px', textAlign: 'center', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <h1 style={{ color: '#28a745' }}>You're on the waitlist!</h1>
        <p style={{ fontSize: '1.1rem', color: '#555' }}>We'll notify you when new jobs matching your interests are posted. Thanks for your interest in URAI!</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '40px', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>Join Our Talent Waitlist</h1>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: '40px' }}>Don't see the right role for you today? Join our waitlist to be the first to know about new opportunities.</p>
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '8px', fontWeight: 'bold' }}>Name (Optional)</label>
          <input {...register('name')} placeholder="Jane Doe" style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '8px', fontWeight: 'bold' }}>Email Address</label>
          <input {...register('email', { required: 'Email is required' })} placeholder="jane.doe@example.com" style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
          {errors.email && <span style={{ color: 'red', marginTop: '8px' }}>{errors.email.message}</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '8px', fontWeight: 'bold' }}>Areas of Interest</label>
          <input {...register('interests')} placeholder="e.g., Engineering, Design, Product Management" style={{ padding: '12px', borderRadius: '5px', border: '1px solid #ccc' }} />
          <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '8px' }}>Separate interests with a comma.</p>
        </div>
        <button type="submit" disabled={loading} style={{ padding: '15px', borderRadius: '5px', border: 'none', backgroundColor: '#007bff', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', marginTop: '20px' }}>
          {loading ? 'Submitting...' : 'Join Waitlist'}
        </button>
        {error && <p style={{ color: 'red', textAlign: 'center', marginTop: '20px' }}>Error: {error.message}</p>}
      </form>
    </div>
  );
};

export default Waitlist;
