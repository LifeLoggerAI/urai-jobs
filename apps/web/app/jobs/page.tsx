import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface Job {
  id: string;
  title: string;
  team: string;
  location: string;
}

async function getJobs(): Promise<Job[]> {
  const jobsCollection = collection(db, "jobs");
  const q = query(jobsCollection, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Job, "id">),
  }));
}

export default async function JobsPage() {
  const jobs = await getJobs();

  return (
    <div className="w-full max-w-4xl mx-auto py-12 px-4 md:px-6">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">Current Openings</h1>
        <p className="text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
          Join our mission to build the future. We're looking for passionate individuals to join our team.
        </p>
      </div>
      <div className="mt-12 space-y-6">
        {jobs.map((job) => (
          <div key={job.id} className="p-6 rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-semibold hover:underline">
                  <a href={`/jobs/${job.id}`}>{job.title}</a>
                </h2>
                <p className="text-gray-500 dark:text-gray-400">{job.team} &middot; {job.location}</p>
              </div>
              <a
                className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-gray-900 text-sm font-medium text-gray-50 shadow transition-colors hover:bg-gray-900/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/90 dark:focus-visible:ring-gray-300"
                href={`/apply/${job.id}`}
              >
                Apply
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
