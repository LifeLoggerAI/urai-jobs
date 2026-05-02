import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function CreateJobPage() {
  const { tokenResult } = useAuth();
  const [jobName, setJobName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (!tokenResult) {
      setError('You must be logged in to create a job.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await tokenResult.token}`,
        },
        body: JSON.stringify({ name: jobName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create job');
      }

      const responseData = await response.json();
      setSuccess(`Job created successfully! Job ID: ${responseData.id}`);
      setJobName(''); // Clear the form
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1>Create a New Job</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="jobName">Job Name:</label>
          <input
            id="jobName"
            type="text"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Job'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}
    </div>
  );
}
