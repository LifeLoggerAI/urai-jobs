import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Job {
  id: string;
  title: string;
  status: string;
}

interface Applicant {
    id: string;
    name: string;
    primaryEmail: string;
    status: string;
    submittedAt: any;
}

interface JobAdminViewProps {
  job: Job;
  onBack: () => void;
}

const JobAdminView: React.FC<JobAdminViewProps> = ({ job, onBack }) => {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobDetails, setJobDetails] = useState<any>(null);

  useEffect(() => {
    const fetchJobDetails = async () => {
      const docRef = doc(db, 'jobs', job.id);
      const docSnap = await getDoc(docRef);
      if(docSnap.exists()) {
          setJobDetails(docSnap.data());
      }
    };
    fetchJobDetails();

    const q = query(collection(db, 'applications'), where('jobId', '==', job.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Applicant));
      setApplicants(appsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [job.id]);

  const handleStatusChange = async (applicationId: string, newStatus: string) => {
      const appRef = doc(db, 'applications', applicationId);
      await updateDoc(appRef, { status: newStatus });
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-blue-600 hover:underline">&larr; Back to Dashboard</button>
      <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">{job.title}</h1>
            <p className={`capitalize font-medium ${job.status === 'open' ? 'text-green-600' : 'text-gray-500'}`}>
              {job.status}
            </p>
          </div>
        <button onClick={() => {}} className="bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700">
          Edit Job
        </button>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">Applicants</h2>
      {loading ? (
        <p>Loading applicants...</p>
      ) : applicants.length > 0 ? (
        <div className="space-y-4">
          {applicants.map(app => (
            <div key={app.id} className="p-4 border rounded-lg">
                <div className="flex justify-between">
                    <div>
                        <p className="font-semibold">{app.name}</p>
                        <p className="text-gray-600">{app.primaryEmail}</p>
                    </div>
                    <div>
                        <select value={app.status} onChange={(e) => handleStatusChange(app.id, e.target.value)} className="p-2 border rounded">
                            <option>NEW</option>
                            <option>SCREEN</option>
                            <option>INTERVIEW</option>
                            <option>OFFER</option>
                            <option>HIRED</option>
                            <option>REJECTED</option>
                        </select>
                    </div>
                </div>
              <p className="text-sm text-gray-500 mt-2">Submitted: {new Date(app.submittedAt?.toDate()).toLocaleString()}</p>
            </div>
          ))}
        </div>
      ) : (
        <p>No applicants for this job yet.</p>
      )}
    </div>
  );
};

export default JobAdminView;
