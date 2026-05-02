import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { handleJob } from './handlers/index.js';

const app = express();
app.use(express.json());

app.post('/execute-job', async (req: any, res: any) => {
  try {
    const result = await handleJob(req.body);
    res.status(200).send(result);
  } catch (error) {
    console.error('Error handling job:', error);
    res.status(500).send({ error: 'Failed to handle job.' });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`narrator-worker listening on port ${port}`);
});
