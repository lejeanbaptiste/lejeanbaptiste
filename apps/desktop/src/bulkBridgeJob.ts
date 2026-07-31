import { fork, type ChildProcess } from 'child_process';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  BulkBridgeJobEvent,
  BulkBridgeJobRequest,
} from '../../commons/src/desktop/bulkBridgeTypes';

export type { BulkBridgeJobEvent, BulkBridgeJobRequest } from '../../commons/src/desktop/bulkBridgeTypes';

const workers = new Map<string, ChildProcess>();

/** Keep XML parsing and reconciliation out of both Chromium and Electron's UI process. */
export function startBulkBridgeJob(
  request: BulkBridgeJobRequest,
  emit: (event: BulkBridgeJobEvent) => void,
): string {
  const jobId = randomUUID();
  const workerPath = path.join(__dirname, 'bulkBridgeWorker.js');
  const worker = fork(workerPath, [], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  workers.set(jobId, worker);
  worker.on('message', (event: BulkBridgeJobEvent) => emit(event));
  worker.on('error', (error) => {
    emit({ jobId, status: 'error', error: error.message });
    workers.delete(jobId);
  });
  worker.on('exit', (code) => {
    workers.delete(jobId);
    if (code && code !== 0) emit({ jobId, status: 'error', error: `Bulk bridge worker exited with code ${code}.` });
  });
  worker.send({ type: 'run', jobId, request });
  return jobId;
}

export function cancelBulkBridgeJob(jobId: string): boolean {
  const worker = workers.get(jobId);
  if (!worker) return false;
  worker.send({ type: 'cancel', jobId });
  return true;
}
