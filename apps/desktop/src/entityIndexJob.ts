import { fork, type ChildProcess } from 'child_process';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  EntityIndexJobEvent,
  EntityIndexJobRequest,
} from '../../commons/src/desktop/entityIndexTypes';

const jobs = new Map<string, ChildProcess>();

export const startEntityIndexJob = (
  request: EntityIndexJobRequest,
  emit: (event: EntityIndexJobEvent) => void,
): string => {
  const jobId = randomUUID();
  const worker = fork(path.join(__dirname, 'entityIndexWorker.js'), [], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  jobs.set(jobId, worker);
  worker.on('message', (event: EntityIndexJobEvent) => emit(event));
  worker.on('error', (error) => {
    emit({ jobId, status: 'error', error: error.message });
    jobs.delete(jobId);
  });
  worker.on('exit', (code) => {
    jobs.delete(jobId);
    if (code && code !== 0)
      emit({ jobId, status: 'error', error: `Entity index worker exited with code ${code}.` });
  });
  worker.send({ type: 'run', jobId, request });
  return jobId;
};

export const cancelEntityIndexJob = (jobId: string): boolean => {
  const worker = jobs.get(jobId);
  if (!worker) return false;
  worker.send({ type: 'cancel', jobId });
  return true;
};

/** Hard-kill every forked indexing worker (see killAllBulkBridgeJobs for why). */
export const killAllEntityIndexJobs = (): void => {
  for (const worker of jobs.values()) worker.kill();
  jobs.clear();
};
