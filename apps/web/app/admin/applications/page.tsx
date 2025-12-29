import { collection, getDocs, orderBy, query, doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import admin from '../../../lib/firebaseAdmin'; // Import the admin SDK

// This tells Next.js to render this page dynamically at request time
export const dynamic = 'force-dynamic';

interface Application {
  id: string;
  name: string;
  email: string;
  jobId: string;
  jobTitle?: string; // Optional: We'll fetch this separately
  status: string;
  analysis?: {
    summary: string;
    skills: string[];
  };
}

// Helper to get job title
async function getJobTitle(jobId: string): Promise<string> {
  try {
    const jobRef = doc(db, "jobs", jobId);
    const jobSnap = await getDoc(jobRef);
    return jobSnap.exists() ? jobSnap.data().title : 'Unknown Job';
  } catch (error) {
    console.error(`Error fetching title for job ${jobId}:`, error);
    return 'Unknown Job';
  }
}

async function getApplications(): Promise<Application[]> {
  const appsCollection = collection(db, "applications");
  const q = query(appsCollection, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);

  const applications = await Promise.all(querySnapshot.docs.map(async (doc) => {
    const data = doc.data();
    const jobTitle = await getJobTitle(data.jobId);
    return {
      id: doc.id,
      jobTitle,
      ...(data as Omit<Application, "id" | "jobTitle">),
    };
  }));

  return applications;
}

export default async function ApplicationsAdminPage() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    redirect('/login');
  }

  try {
    const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true /** checkRevoked */);
    if (!decodedClaims.admin) {
      redirect('/login');
    }
  } catch (error) {
    // Session cookie is invalid or expired. Force user to login.
    redirect('/login');
  }

  const applications = await getApplications();

  return (
    <div className="w-full max-w-6xl mx-auto py-12 px-4 md:px-6">
      <div className="space-y-2 mb-10">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">Submitted Applications</h1>
        <p className="text-gray-500 md:text-xl/relaxed dark:text-gray-400">
          Review and manage all job applications.
        </p>
      </div>

      <div className="space-y-8">
        {applications.map((app) => (
          <div key={app.id} className="p-6 rounded-lg border bg-white dark:border-gray-800 dark:bg-gray-950 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between sm:items-start">
              <div className="mb-4 sm:mb-0">
                <h2 className="text-2xl font-semibold hover:underline">
                  <Link href={`/admin/applications/${app.id}`}>{app.name}</Link>
                </h2>
                <p className="text-gray-500 dark:text-gray-400">Applied for: {app.jobTitle}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{app.email}</p>
              </div>
              <div className={`px-3 py-1 text-sm rounded-full ${app.status === 'analyzed' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                {app.status}
              </div>
            </div>
            {app.analysis && (
              <div className="mt-6 border-t pt-6">
                <h3 className="text-lg font-semibold">AI Resume Analysis</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <h4 className="font-semibold">Summary</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{app.analysis.summary}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">Skills</h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {app.analysis.skills.map(skill => (
                        <span key={skill} className="px-2 py-1 text-xs rounded-md bg-gray-200 dark:bg-gray-700">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
