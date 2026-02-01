
'use client';

import { useJobs } from '@/hooks/useJobs';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function JobsPage() {
  const { user, loading: authLoading } = useAuth();
  const { jobs, loading: jobsLoading, error } = useJobs();
  const router = useRouter();

  if (authLoading || jobsLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h1>Jobs</h1>
      <button onClick={() => auth.signOut()}>Sign out</button>
      <ul>
        {jobs.map((job) => (
          <li key={job.id}>
            <a href={`/jobs/${job.id}`}>{job.id}</a> - {job.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
