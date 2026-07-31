import { fork, type ChildProcess } from 'child_process';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  BulkBridgeJobEvent,
  BulkBridgeJobRequest,
} from '../../commons/src/desktop/bulkBridgeTypes';

export type { BulkBridgeJobEvent, BulkBridgeJobRequest } from '../../commons/src/desktop/bulkBridgeTypes';

const workers = new Map<string, ChildProcess>();

/**
 * The worker writes `entities.xml` directly (no `window.electronAPI` in a
 * forked child process, so it can't arm/ignore its own writes the way the
 * renderer does via `EntityStore.saveEntities`). Route its arm/ignore
 * requests to the main process's own file watcher instead, or every
 * checkpoint/final write during a sync looks like an external edit and pops
 * the "entity database changed externally" prompt.
 */
export interface FileWriteWatcher {
  armWrite: (filePath: string) => void;
  ignoreChange: (filePath: string, mtimeMs: number) => void;
}

type WorkerToMainMessage =
  | BulkBridgeJobEvent
  | { kind: 'arm-write'; filePath: string }
  | { kind: 'ignore-write'; filePath: string; mtimeMs: number };

/** Keep XML parsing and reconciliation out of both Chromium and Electron's UI process. */
export function startBulkBridgeJob(
  request: BulkBridgeJobRequest,
  emit: (event: BulkBridgeJobEvent) => void,
  fileWatcher?: FileWriteWatcher,
): string {
  const jobId = randomUUID();
  const workerPath = path.join(__dirname, 'bulkBridgeWorker.js');
  const worker = fork(workerPath, [], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  workers.set(jobId, worker);
  worker.on('message', (message: WorkerToMainMessage) => {
    if ('kind' in message) {
      if (message.kind === 'arm-write') fileWatcher?.armWrite(message.filePath);
      else fileWatcher?.ignoreChange(message.filePath, message.mtimeMs);
      return;
    }
    emit(message);
  });
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

/**
 * Hard-kill every forked bulk-bridge worker. A merge over a large database
 * can run for a long time; without this, quitting (or restarting the dev
 * server, which doesn't touch already-forked child processes) leaves the
 * worker running as an orphan that keeps burning CPU underneath the next
 * app instance.
 */
export function killAllBulkBridgeJobs(): void {
  for (const worker of workers.values()) worker.kill();
  workers.clear();
}
