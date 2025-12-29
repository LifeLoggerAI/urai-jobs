// This page displays the details for a single job from Firestore.
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { notFound } from 'next/navigation';

interface Job {
  id: string;
  title: string;
  team: string;
  location: string;
  description: string;
}

interface JobDetailPageProps {
  params: {
    jobId: string;
  };
}

// This function fetches a specific job from Firestore.
async function getJob(jobId: string): Promise<Job | null> {
  const docRef = doc(db, "jobs", jobId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    // Type assertion to ensure the data matches the Job interface
    return { id: docSnap.id, ...docSnap.data() } as Job;
  } else {
    return null;
  }
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const job = await getJob(params.jobId);

  // If the job isn't found, show a 404 page.
  if (!job) {
    notFound();
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-12 px-4 md:px-6">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">{job.title}</h1>
          <p className="text-gray-500 md:text-xl dark:text-gray-400">{job.team} &middot; {job.location}</p>
        </div>

        <div className="prose max-w-none dark:prose-invert">
          <div dangerouslySetInnerHTML={{ __html: job.description }} />
        </div>

        <div className="pt-6">
          <a
            className="inline-flex items-center justify-center h-11 px-8 rounded-md bg-gray-900 text-lg font-medium text-gray-50 shadow transition-colors hover:bg-gray-900/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/90 dark:focus-visible:ring-gray-300"
            href={`/apply/${job.id}`}
          >
            Apply Now
          </a>
        </div>
      </div>
    </div>
  );
}
