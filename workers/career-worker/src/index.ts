import express from 'express';
import { handleJob } from './handlers/index';

const app = express();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';

app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.status(200).send({ service: 'career-worker', ok: true });
});

app.get('/healthz', (_req, res) => {
  res.status(200).send({ service: 'career-worker', ok: true });
});

app.post('/execute-job', async (req, res) => {
  const result = await handleJob(req.body ?? {});
  res.status(200).send(result);
});

app.listen(port, host, () => {
  console.log(JSON.stringify({ event: 'worker.started', service: 'career-worker', host, port }));
});
