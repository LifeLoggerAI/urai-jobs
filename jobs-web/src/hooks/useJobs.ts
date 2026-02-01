
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export const useJobs = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      if (!user) return;

      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/jobs', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch jobs');
        }

        const data = await response.json();
        setJobs(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [user]);

  return { jobs, loading, error };
};
