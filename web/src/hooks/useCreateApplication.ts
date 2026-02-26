
import { useState } from 'react';
import { db, functions, ORG_ID } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { v4 as uuidv4 } from 'uuid';

// Define the structure of the data expected by the hook
interface ApplicationData {
  name: string;
  primaryEmail: string;
  phone?: string;
  portfolio?: string;
  linkedin?: string;
  github?: string;
  resume: FileList;
  jobId: string;
}

/**
 * Hook for creating a new application.
 * This encapsulates the entire application submission flow, including resume upload.
 */
const useCreateApplication = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createApplication = async (data: ApplicationData) => {
    setLoading(true);
    setError(null);

    try {
      const applicantId = uuidv4();
      const applicationId = uuidv4();
      const resumeFile = data.resume[0];

      if (!resumeFile) {
        throw new Error('Resume file is required.');
      }

      // 1. Get signed URL for resume upload from the multi-tenant callable function
      const createResumeUpload = httpsCallable(functions, 'createResumeUpload');
      const uploadResult = await createResumeUpload({
        orgId: ORG_ID, // Pass orgId to the function
        applicationId,
        filename: resumeFile.name,
        contentType: resumeFile.type,
        size: resumeFile.size,
      });

      const { url, path } = uploadResult.data as { url: string; path: string; };

      // 2. Upload resume to the obtained signed URL
      await fetch(url, {
        method: 'PUT',
        body: resumeFile,
        headers: {
          'Content-Type': resumeFile.type,
        },
      });

      // 3. Create applicant document in the org's subcollection
      await addDoc(collection(db, `orgs/${ORG_ID}/applicants`), {
        applicantId,
        name: data.name,
        primaryEmail: data.primaryEmail.toLowerCase(),
        phone: data.phone,
        links: {
          portfolio: data.portfolio,
          linkedin: data.linkedin,
          github: data.github,
        },
        source: { type: 'direct' },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
      });

      // 4. Create application document in the org's subcollection
      await addDoc(collection(db, `orgs/${ORG_ID}/applications`), {
        applicationId,
        jobId: data.jobId,
        applicantId,
        applicantEmail: data.primaryEmail.toLowerCase(),
        status: 'NEW',
        answers: {},
        resume: {
          storagePath: path,
          filename: resumeFile.name,
          contentType: resumeFile.type,
          size: resumeFile.size,
        },
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      return { success: true, applicationId };
    } catch (err) {
      console.error("Error creating application:", err);
      setError(err as Error);
      setLoading(false);
      return { success: false };
    }
  };

  return { createApplication, loading, error };
};

export default useCreateApplication;
