
import { NextApiRequest, NextApiResponse } from 'next';
import { firebaseAdmin } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authorization } = req.headers;
  if (!authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authorization.split('Bearer ')[1];
  try {
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    const { uid } = decodedToken;

    const jobsRef = firebaseAdmin.firestore().collection('jobs');
    const snapshot = await jobsRef.where('ownerUid', '==', uid).get();

    const jobs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json(jobs);
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
