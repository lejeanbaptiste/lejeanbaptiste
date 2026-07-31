import { DOMParser as XmldomParser, XMLSerializer as XmldomSerializer } from '@xmldom/xmldom';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  parseEntities,
  serializeEntities,
} from '../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import { bulkBridgeImport } from '../../../packages/cwrc-leafwriter/src/autoTagging/bulkBridgeImport';
import type {
  BulkBridgeJobEvent,
  BulkBridgeJobRequest,
} from '../../commons/src/desktop/bulkBridgeTypes';
import { installBrowserDomShim } from './xmldomShim';

const cancelled = new Set<string>();

const send = (event: BulkBridgeJobEvent): void => {
  process.send?.(event);
};

/**
 * Mirrors `EntityStore.saveEntities`'s arm/ignore pair (see
 * `desktopEntityFileApi`), which this worker can't call directly — a forked
 * child process has no `window.electronAPI`. Without this, every checkpoint
 * and final write here looks like an external edit to the main process's
 * file watcher and pops the "entity database changed externally" prompt,
 * even though it's this same sync writing the file.
 */
const atomicWrite = async (filePath: string, content: string, jobId: string): Promise<void> => {
  process.send?.({ kind: 'arm-write', filePath });
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${jobId}.${randomUUID()}.tmp`;
  await fs.writeFile(temporaryPath, content, 'utf8');
  await fs.rename(temporaryPath, filePath);
  const { mtimeMs } = await fs.stat(filePath);
  process.send?.({ kind: 'ignore-write', filePath, mtimeMs });
};

process.on('message', async (message: { type: 'run' | 'cancel'; jobId: string; request?: BulkBridgeJobRequest }) => {
  if (message.type === 'cancel') {
    cancelled.add(message.jobId);
    return;
  }
  const request = message.request;
  if (!request) return;
  const jobId = message.jobId;
  try {
    (globalThis as unknown as { DOMParser: typeof XmldomParser }).DOMParser = XmldomParser;
    (globalThis as unknown as { XMLSerializer: typeof XmldomSerializer }).XMLSerializer = XmldomSerializer;
    const sourceDoc = parseEntities(await fs.readFile(request.sourceEntitiesPath, 'utf8'));
    const centralDoc = parseEntities(await fs.readFile(request.centralEntitiesPath, 'utf8'));
    installBrowserDomShim(sourceDoc);
    installBrowserDomShim(centralDoc);
    const result = await bulkBridgeImport({
      sourceDoc,
      centralDoc,
      userStableId: request.userStableId,
      chunkSize: request.chunkSize,
      shouldCancel: () => cancelled.has(jobId),
      onProgress: (progress) => send({ jobId, status: 'progress', progress }),
      onCheckpoint: async () => {
        await atomicWrite(request.sourceEntitiesPath, serializeEntities(sourceDoc), jobId);
        await atomicWrite(request.centralEntitiesPath, serializeEntities(centralDoc), jobId);
      },
    });
    const proposalPath = path.join(request.centralLjbDir, 'bulk-import-proposals.jsonl');
    const proposalText = result.proposals.map((proposal) => JSON.stringify(proposal)).join('\n');
    await atomicWrite(proposalPath, proposalText ? `${proposalText}\n` : '', jobId);
    if (!cancelled.has(jobId)) {
      if (result.sourceChanged) await atomicWrite(request.sourceEntitiesPath, serializeEntities(sourceDoc), jobId);
      if (result.centralChanged) await atomicWrite(request.centralEntitiesPath, serializeEntities(centralDoc), jobId);
    }
    send({ jobId, status: cancelled.has(jobId) ? 'cancelled' : 'complete', result });
  } catch (error) {
    send({ jobId, status: 'error', error: error instanceof Error ? error.message : String(error) });
  } finally {
    cancelled.delete(jobId);
  }
});
