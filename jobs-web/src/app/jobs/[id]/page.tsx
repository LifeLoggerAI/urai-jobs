
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function JobPage({ params }: { params: { id: string } }) {
  const { user, loading: authLoading } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchJob = async () => {
      if (!user) return;

      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/jobs/${params.id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch job');
        }

        const data = await response.json();
        setJob(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [user, params.id]);

  if (authLoading || loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!job) {
    return <div>Job not found</div>;
  }

  return (
    <div>
      <h1>Job Details</h1>
      <p>ID: {job.id}</p>
      <p>Status: {job.status}</p>
      <p>Owner: {job.ownerUid}</p>
    </div>
  );
}
