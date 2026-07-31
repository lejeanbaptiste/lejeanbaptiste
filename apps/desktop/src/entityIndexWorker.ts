import { DOMParser as XmldomParser } from '@xmldom/xmldom';
import fs from 'fs/promises';
import path from 'path';
import {
  entityElements,
  type EntityKind,
  parseEntities,
} from '../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import {
  listConcordanceRejections,
  summarizeEntity,
  type EntitySummary,
} from '../../../packages/cwrc-leafwriter/src/autoTagging/entityOps';
import type {
  EntityIndexJobEvent,
  EntityIndexJobRequest,
} from '../../commons/src/desktop/entityIndexTypes';
import { installBrowserDomShim } from './xmldomShim';

const cancelled = new Set<string>();
const send = (event: EntityIndexJobEvent): void => {
  process.send?.(event);
};

interface EntityIndexCache {
  version: 1;
  source: { size: number; mtimeMs: number };
  entities: EntitySummary[];
}

const sendBatches = async (
  jobId: string,
  entities: EntitySummary[],
  phase: 'cache' | 'indexing',
  cancelled: Set<string>,
  chunkSize: number,
): Promise<boolean> => {
  for (let offset = 0; offset < entities.length; offset += chunkSize) {
    if (cancelled.has(jobId)) {
      send({ jobId, status: 'cancelled', done: offset, total: entities.length });
      return false;
    }
    send({
      jobId,
      status: 'progress',
      phase,
      done: Math.min(offset + chunkSize, entities.length),
      total: entities.length,
      batch: entities.slice(offset, offset + chunkSize),
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return true;
};

process.on('message', async (message: { type: 'run' | 'cancel'; jobId: string; request?: EntityIndexJobRequest }) => {
  if (message.type === 'cancel') {
    cancelled.add(message.jobId);
    return;
  }
  if (!message.request) return;
  const { jobId, request } = message;
  try {
    send({ jobId, status: 'progress', phase: 'parsing', done: 0, total: 0 });
    (globalThis as unknown as { DOMParser: typeof XmldomParser }).DOMParser = XmldomParser;
    const sourceStat = await fs.stat(request.entitiesPath);
    const chunkSize = Math.max(50, request.chunkSize ?? 250);
    if (request.indexCachePath) {
      try {
        const cached = JSON.parse(await fs.readFile(request.indexCachePath, 'utf8')) as EntityIndexCache;
        if (
          cached.version === 1 &&
          cached.source.size === sourceStat.size &&
          cached.source.mtimeMs === sourceStat.mtimeMs &&
          Array.isArray(cached.entities)
        ) {
          const sent = await sendBatches(jobId, cached.entities, 'cache', cancelled, chunkSize);
          if (!sent) return;
          send({ jobId, status: 'complete', done: cached.entities.length, total: cached.entities.length });
          return;
        }
      } catch {
        // Cache misses and stale/corrupt caches fall through to a fresh index.
      }
    }
    const doc = parseEntities(await fs.readFile(request.entitiesPath, 'utf8'));
    installBrowserDomShim(doc);
    const kinds = Object.keys({ person: 1, place: 1, org: 1, work: 1, office: 1 }) as EntityKind[];
    const items = kinds.flatMap((kind) => entityElements(doc, kind));
    const allRejections = listConcordanceRejections(doc);
    const allSummaries: EntitySummary[] = [];
    for (let offset = 0; offset < items.length; offset += chunkSize) {
      if (cancelled.has(jobId)) {
        send({ jobId, status: 'cancelled', done: offset, total: items.length });
        return;
      }
      const batch: EntitySummary[] = items
        .slice(offset, offset + chunkSize)
        .map((item) => summarizeEntity(item, allRejections))
        .filter((summary): summary is EntitySummary => !!summary);
      allSummaries.push(...batch);
      send({
        jobId,
        status: 'progress',
        phase: 'indexing',
        done: Math.min(offset + chunkSize, items.length),
        total: items.length,
        batch,
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    if (request.indexCachePath) {
      await fs.mkdir(path.dirname(request.indexCachePath), { recursive: true });
      const temporaryPath = `${request.indexCachePath}.${jobId}.tmp`;
      await fs.writeFile(
        temporaryPath,
        JSON.stringify({ version: 1, source: { size: sourceStat.size, mtimeMs: sourceStat.mtimeMs }, entities: allSummaries }),
        'utf8',
      );
      await fs.rename(temporaryPath, request.indexCachePath);
    }
    send({ jobId, status: 'complete', done: items.length, total: items.length });
  } catch (error) {
    send({ jobId, status: 'error', error: error instanceof Error ? error.message : String(error) });
  } finally {
    cancelled.delete(jobId);
  }
});
