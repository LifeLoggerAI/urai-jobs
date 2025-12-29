// This component is a Client Component to handle user interaction.
"use client";

import { useState, useEffect, FormEvent } from 'react';
import { notFound } from 'next/navigation';
// Import the functions we need to call our backend
import { functions, httpsCallable } from '../../../lib/firebase'; 
import { mockJobPostings } from '../../../lib/mock-data'; 

interface ApplyPageProps {
  params: {
    jobId: string;
  };
}

interface Job {
  id: string;
  title: string;
}

// Get a reference to the secureApply function
const secureApply = httpsCallable(functions, 'secureApply');

export default function ApplyPage({ params }: ApplyPageProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [resume, setResume] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const currentJob = mockJobPostings.find((j) => j.id === params.jobId);
    if (currentJob) {
      setJob({ id: currentJob.id, title: currentJob.title });
    } else {
      notFound();
    }
  }, [params.jobId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      // Call the backend function with the form data
      const result = await secureApply({
        jobId: job?.id,
        name,
        email,
        resume,
      });

      console.log("Function result:", result.data);
      setSuccess(true);
    } catch (err: any) {
      console.error("Error submitting application:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!job) {
    return <div className="w-full max-w-2xl mx-auto py-12 px-4 md:px-6 text-center">Loading...</div>;
  }

  // If the form was submitted successfully, show a confirmation message.
  if (success) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 px-4 md:px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tighter">Application Submitted!</h2>
        <p className="text-gray-500 mt-4">Thank you for applying for the {job.title} position. We will review your application and be in touch.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto py-12 px-4 md:px-6">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">Apply for {job.title}</h1>
      </div>
      <div className="mt-10">
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* ... form inputs ... */}
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Full Name</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email Address</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div className="space-y-2">
            <label htmlFor="resume" className="text-sm font-medium">Resume/CV (Plain Text)</label>
            <textarea id="resume" value={resume} onChange={(e) => setResume(e.target.value)} required className="flex min-h-[150px] w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center w-full h-11 px-8 rounded-md bg-gray-900 text-lg font-medium text-gray-50 shadow hover:bg-gray-900/90 disabled:opacity-50">
            {isSubmitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  );
}
