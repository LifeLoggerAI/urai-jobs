
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
      <div>
        <h1>You're on the waitlist!</h1>
        <p>We'll notify you when new jobs matching your interests are posted.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Join Our Waitlist</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <input {...register('name')} placeholder="Name" />
        <input {...register('email', { required: true })} placeholder="Email" />
        {errors.email && <span>Email is required</span>}
        <input {...register('interests')} placeholder="Interests (comma-separated)" />
        <button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Join Waitlist'}
        </button>
        {error && <p>Error: {error.message}</p>}
      </form>
    </div>
  );
};

export default Waitlist;
