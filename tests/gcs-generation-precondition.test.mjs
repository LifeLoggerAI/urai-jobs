import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { test } from 'node:test';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { Storage } = require('@google-cloud/storage');

test('the installed Storage SDK sends an exact generation precondition and propagates a conflict', async () => {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url });
    response.writeHead(412, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 412, message: 'synthetic generation mismatch' } }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const prior = process.env.STORAGE_EMULATOR_HOST;
  process.env.STORAGE_EMULATOR_HOST = `http://127.0.0.1:${server.address().port}`;
  try {
    const storage = new Storage({ projectId: 'demo-urai-jobs-cleanup', retryOptions: { autoRetry: false } });
    const generation = '9007199254740993';
    await assert.rejects(
      storage.bucket('synthetic-bucket').file('synthetic/file.mp4', {
        preconditionOpts: { ifGenerationMatch: generation },
      }).delete(),
      error => error.code === 412,
    );
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, 'DELETE');
    assert.equal(new URL(requests[0].url, 'http://127.0.0.1').searchParams.get('ifGenerationMatch'), generation);
  } finally {
    if (prior === undefined) delete process.env.STORAGE_EMULATOR_HOST;
    else process.env.STORAGE_EMULATOR_HOST = prior;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
