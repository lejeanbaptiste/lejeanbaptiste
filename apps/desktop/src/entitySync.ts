/**
 * Entity-sync orchestrator — Phase 2 of docs/entity-sync-planning.md.
 *
 * `runSync` pulls every change past the local cursor, applies the clean ones
 * and queues conflicts, then pushes the local dirty set. Server-authoritative:
 * on a stale-base push or a dirty-local pull collision, nothing local is
 * overwritten — a `sync_conflicts` row is opened and the entity is held back
 * until resolved.
 *
 * All database writes for one pull page / one push chunk happen inside a
 * single `repo.transaction()`.
 */
import type { EntitySqliteRepository } from './entityDbSqlite/repository';
import {
  applyRemoteEntity,
  countOpenConflicts,
  exportLocalEntityXml,
  getSyncCursor,
  getSyncState,
  listDirtyForSync,
  localEntityHash,
  openConflict,
  resolveConflict,
  setSyncCursor,
  upsertSyncState,
  type DirtyEntity,
} from './entityDbSqlite/entitySyncRepo';
import {
  EntitySyncClient,
  type SyncAppliedEntity,
  type SyncConflictEntity,
  type SyncPullChange,
  type SyncPushEntity,
} from './entitySyncClient';

type SyncClient = Pick<EntitySyncClient, 'pull' | 'push'>;

export interface SyncRunResult {
  pulledApplied: number;
  pulledConflicts: number;
  pushedApplied: number;
  pushedReconciled: number;
  pushedConflicts: number;
  cursor: number;
  openConflicts: number;
}

export type SyncProgress =
  | { phase: 'pull'; page: number; applied: number; conflicts: number; more: boolean }
  | { phase: 'push'; chunk: number; chunks: number; applied: number; conflicts: number };

export interface RunSyncOptions {
  repo: EntitySqliteRepository;
  client: SyncClient;
  pullLimit?: number;
  /** Abort between pages / chunks — used for the service-level run timeout. */
  signal?: AbortSignal;
  onProgress?: (progress: SyncProgress) => void;
}

export class SyncAbortedError extends Error {
  constructor() {
    super('entity sync was aborted');
    this.name = 'SyncAbortedError';
  }
}

const checkAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw new SyncAbortedError();
};

const emptyResult = (cursor: number): SyncRunResult => ({
  pulledApplied: 0,
  pulledConflicts: 0,
  pushedApplied: 0,
  pushedReconciled: 0,
  pushedConflicts: 0,
  cursor,
  openConflicts: 0,
});

export async function runSync(options: RunSyncOptions): Promise<SyncRunResult> {
  const { repo, client, pullLimit = 500, signal, onProgress } = options;
  const result = emptyResult(getSyncCursor(repo));

  // ---- pull ----
  result.cursor = await pullPhase(repo, client, pullLimit, result, signal, onProgress);

  // ---- push ----
  const dirty = listDirtyForSync(repo);
  const batches = [...chunked(dirty, EntitySyncClient.pushChunkLimit)];
  let chunkIndex = 0;
  for (const batch of batches) {
    chunkIndex += 1;
    checkAborted(signal);
    const payload = batch
      .map((d) => toPushEntity(repo, d))
      .filter((p): p is SyncPushEntity => p !== null);
    if (payload.length === 0) continue;

    const res = await client.push(payload);
    const byLocal = new Map(batch.map((d) => [d.localId, d]));
    repo.transaction(() => {
      for (const applied of res.applied) {
        const d = byLocal.get(applied.localId);
        if (!d) continue;
        recordPushSuccess(repo, d, applied);
        result.pushedApplied += 1;
      }
      for (const reconciled of res.reconciled) {
        const d = byLocal.get(reconciled.localId);
        if (!d) continue;
        recordPushSuccess(repo, d, reconciled);
        result.pushedReconciled += 1;
      }
      for (const conflict of res.conflicts) {
        const d = byLocal.get(conflict.localId);
        if (!d) continue;
        recordPushConflict(repo, d, conflict);
        result.pushedConflicts += 1;
      }
    });
    onProgress?.({
      phase: 'push',
      chunk: chunkIndex,
      chunks: batches.length,
      applied: result.pushedApplied,
      conflicts: result.pushedConflicts,
    });
  }

  // Drain anything that landed while we were pushing (our own writes are
  // recognised and skipped; a concurrent device's writes get applied/queued).
  result.cursor = await pullPhase(repo, client, pullLimit, result, signal, onProgress);

  result.openConflicts = countOpenConflicts(repo);
  return result;
}

// --- pull ----------------------------------------------------------------

async function pullPhase(
  repo: EntitySqliteRepository,
  client: SyncClient,
  pullLimit: number,
  result: SyncRunResult,
  signal: AbortSignal | undefined,
  onProgress: ((progress: SyncProgress) => void) | undefined,
): Promise<number> {
  let cursor = getSyncCursor(repo);
  let page = 0;
  for (;;) {
    checkAborted(signal);
    page += 1;
    const pulled = await client.pull(cursor, pullLimit);
    if (pulled.changes.length > 0) {
      repo.transaction(() => {
        for (const change of pulled.changes) applyPulledChange(repo, change, result);
        cursor = Math.max(cursor, pulled.highSeq);
        setSyncCursor(repo, cursor);
      });
    } else {
      cursor = Math.max(cursor, pulled.highSeq);
      setSyncCursor(repo, cursor);
    }
    onProgress?.({
      phase: 'pull',
      page,
      applied: result.pulledApplied,
      conflicts: result.pulledConflicts,
      more: pulled.hasMore && pulled.changes.length > 0,
    });
    if (!pulled.hasMore || pulled.changes.length === 0) break;
  }
  return cursor;
}

function applyPulledChange(
  repo: EntitySqliteRepository,
  change: SyncPullChange,
  result: SyncRunResult,
): void {
  const localEntity = repo.getEntity(change.centralId);
  const state = getSyncState(repo, change.centralId);

  // Already in sync with this exact version — typically our own just-pushed
  // write coming back on the next pull. Nothing to do; the cursor still
  // advances per page.
  if (state && state.centralRevision === change.revision && state.centralHash === change.contentHash) {
    return;
  }

  const localIsDirty = Boolean(
    localEntity && (!state || state.projectRevision !== localEntity.revision),
  );

  if (localEntity && localIsDirty) {
    const localHash = localEntity.deletedAt
      ? ''
      : (localEntityHash(repo, change.centralId) ?? '');
    if (localHash !== change.contentHash) {
      openConflict(repo, {
        projectEntityId: change.centralId,
        centralEntityId: change.centralId,
        reason: 'pull-collision',
        projectRevision: localEntity.revision,
        centralRevision: change.revision,
        projectSnapshot: localEntity.deletedAt
          ? ''
          : (exportLocalEntityXml(repo, change.centralId) ?? ''),
        centralSnapshot: change.contentXml,
      });
      result.pulledConflicts += 1;
      return;
    }
  }

  const { afterHash, projectRevision } = applyRemoteEntity(repo, {
    centralId: change.centralId,
    kind: change.kind,
    contentXml: change.contentXml,
    deleted: change.deleted,
  });
  upsertSyncState(repo, {
    projectEntityId: change.centralId,
    centralEntityId: change.centralId,
    centralRevision: change.revision,
    projectRevision,
    centralHash: change.contentHash,
    projectHash: afterHash,
  });
  result.pulledApplied += 1;
}

// --- push ----------------------------------------------------------------

function toPushEntity(repo: EntitySqliteRepository, d: DirtyEntity): SyncPushEntity | null {
  if (d.deleted) {
    return {
      localId: d.localId,
      centralId: d.centralId ?? undefined,
      kind: d.kind,
      baseRevision: d.baseRevision,
      contentXml: '',
      contentHash: '',
      deleted: true,
    };
  }
  const contentXml = exportLocalEntityXml(repo, d.localId);
  const contentHash = localEntityHash(repo, d.localId);
  if (!contentXml || !contentHash) return null; // entity vanished mid-run
  return {
    localId: d.localId,
    centralId: d.centralId ?? undefined,
    kind: d.kind,
    baseRevision: d.baseRevision,
    contentXml,
    contentHash,
    deleted: false,
  };
}

function recordPushSuccess(
  repo: EntitySqliteRepository,
  d: DirtyEntity,
  outcome: SyncAppliedEntity,
): void {
  const liveRevision = repo.getEntity(d.localId)?.revision ?? d.revision;
  const hash = d.deleted ? '' : (localEntityHash(repo, d.localId) ?? '');
  upsertSyncState(repo, {
    projectEntityId: d.localId,
    centralEntityId: outcome.centralId,
    centralRevision: outcome.revision,
    projectRevision: liveRevision,
    // We just pushed this content (or the server confirmed it already matched),
    // so local content == central content.
    centralHash: hash,
    projectHash: hash,
  });
}

function recordPushConflict(
  repo: EntitySqliteRepository,
  d: DirtyEntity,
  conflict: SyncConflictEntity,
): void {
  openConflict(repo, {
    projectEntityId: d.localId,
    centralEntityId: conflict.centralId,
    reason: 'push-rejected',
    projectRevision: repo.getEntity(d.localId)?.revision ?? d.revision,
    centralRevision: conflict.serverRevision,
    projectSnapshot: d.deleted ? '' : (exportLocalEntityXml(repo, d.localId) ?? ''),
    centralSnapshot: conflict.serverXml,
  });
}

// --- conflict resolution (logic; Phase 4 wires the UI) -----------------

const STAYS_DIRTY = -1;

/** Keep the local version: next sync pushes it against the server's revision. */
export function resolveConflictKeepLocal(repo: EntitySqliteRepository, conflictId: number): boolean {
  const conflict = repo.db
    .prepare(
      `SELECT project_entity_id, central_entity_id, central_revision
         FROM sync_conflicts WHERE id = ? AND status = 'open'`,
    )
    .get(conflictId) as
    | { project_entity_id: string; central_entity_id: string; central_revision: number }
    | undefined;
  if (!conflict) return false;

  repo.transaction(() => {
    upsertSyncState(repo, {
      projectEntityId: conflict.project_entity_id,
      centralEntityId: conflict.central_entity_id,
      centralRevision: conflict.central_revision,
      // Sentinel: never equals a real revision, so the entity stays in the
      // dirty set and re-pushes with baseRevision = the server's revision.
      projectRevision: STAYS_DIRTY,
      centralHash: '',
      projectHash: '',
    });
    resolveConflict(repo, conflictId);
  });
  return true;
}

/** Keep the server version: apply its snapshot over the local entity. */
export function resolveConflictKeepRemote(
  repo: EntitySqliteRepository,
  conflictId: number,
): boolean {
  const conflict = repo.db
    .prepare(
      `SELECT project_entity_id, central_entity_id, central_revision, central_snapshot
         FROM sync_conflicts WHERE id = ? AND status = 'open'`,
    )
    .get(conflictId) as
    | {
        project_entity_id: string;
        central_entity_id: string;
        central_revision: number;
        central_snapshot: string;
      }
    | undefined;
  if (!conflict) return false;

  const kind = repo.getEntity(conflict.central_entity_id)?.kind;
  if (!kind) return false;
  const deleted = conflict.central_snapshot.trim().length === 0;

  repo.transaction(() => {
    const { afterHash, projectRevision } = applyRemoteEntity(repo, {
      centralId: conflict.central_entity_id,
      kind,
      contentXml: conflict.central_snapshot,
      deleted,
    });
    upsertSyncState(repo, {
      projectEntityId: conflict.project_entity_id,
      centralEntityId: conflict.central_entity_id,
      centralRevision: conflict.central_revision,
      projectRevision,
      centralHash: deleted ? '' : afterHash,
      projectHash: deleted ? '' : afterHash,
    });
    resolveConflict(repo, conflictId);
  });
  return true;
}

// --- utils -------------------------------------------------------------

function* chunked<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}
