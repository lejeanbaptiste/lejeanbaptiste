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

const cancelled = new Set<string>();

const send = (event: BulkBridgeJobEvent): void => {
  process.send?.(event);
};

const atomicWrite = async (filePath: string, content: string, jobId: string): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${jobId}.${randomUUID()}.tmp`;
  await fs.writeFile(temporaryPath, content, 'utf8');
  await fs.rename(temporaryPath, filePath);
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
