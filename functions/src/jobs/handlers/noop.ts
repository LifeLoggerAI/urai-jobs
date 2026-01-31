import { JobRun } from '../../models';

export default async function (run: JobRun): Promise<void> {
  console.log(`Executing noop handler for run ${run.idempotencyKey}`);
  // Do nothing
}
