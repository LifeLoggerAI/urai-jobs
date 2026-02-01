
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
    const { id } = req.query;

    const jobRef = firebaseAdmin.firestore().collection('jobs').doc(id as string);
    const doc = await jobRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = { id: doc.id, ...doc.data() };

    if (job.ownerUid !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.status(200).json(job);
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
