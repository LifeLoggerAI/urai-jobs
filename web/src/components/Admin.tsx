import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from './firebase';

const Admin = () => {
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    const fetchApplications = async () => {
      const q = query(
        collection(db, 'applications'),
        orderBy('submittedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const applicationList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setApplications(applicationList);
    };

    fetchApplications();
  }, []);

  return (
    <div>
      <h2>Admin Console</h2>
      <table>
        <thead>
          <tr>
            <th>Applicant</th>
            <th>Job</th>
            <th>Status</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {applications.map(app => (
            <tr key={app.id}>
              <td>{app.applicantEmail}</td>
              <td>{app.jobId}</td>
              <td>{app.status}</td>
              <td>{app.submittedAt.toDate().toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Admin;
