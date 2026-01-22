import { JobEngine } from '../src/engine';
import { assert } from 'chai';

describe('JobEngine', () => {
  it('should enqueue a job', async () => {
    const engine = new JobEngine();
    const idempotencyKey = `test-${Date.now()}`;
    const job = await engine.enqueue('test', { foo: 'bar' }, { idempotencyKey });
    assert.isObject(job, 'job should be an object');
    assert.equal(job.type, 'test', 'job type should be test');
    assert.equal(job.idempotencyKey, idempotencyKey, 'idempotencyKey should be set');
  });
});
