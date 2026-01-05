import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';

interface Job extends DocumentData {
  id: string;
  title: string;
  department: string;
  locationText: string;
}

const JobsPage = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      try {
        const jobsCollection = collection(db, 'jobPublic');
        const q = query(jobsCollection, where('status', '==', 'open'));
        const jobSnapshot = await getDocs(q);
        const jobList = jobSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
        setJobs(jobList);
      } catch (error) {
        console.error("Error fetching jobs:", error);
      }
      setLoading(false);
    };

    fetchJobs();
  }, []);

  if (loading) {
    return <div className="text-center p-8">Loading jobs...</div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-4xl font-extrabold text-center mb-8 text-gray-800">Open Positions</h1>
      {jobs.length === 0 ? (
        <p className="text-center text-gray-500">No open positions at the moment. Please check back later.</p>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map(job => (
            <div key={job.id} className="bg-white border border-gray-200 p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300">
              <h2 className="text-2xl font-bold text-gray-900">{job.title}</h2>
              <p className="text-md text-gray-600 mt-1">{job.department}</p>
              <p className="text-sm text-gray-500 mt-1">{job.locationText}</p>
              <Link to={`/jobs/${job.id}`} className="text-blue-600 hover:underline mt-4 inline-block font-semibold">View Details &rarr;</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobsPage;
