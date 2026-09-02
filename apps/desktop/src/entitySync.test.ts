import { EntitySqliteRepository } from './entityDbSqlite/repository';
import {
  countOpenConflicts,
  exportLocalEntityXml,
  getSyncCursor,
  listDirtyForSync,
  listOpenConflicts,
  localEntityHash,
  setSyncCursor,
} from './entityDbSqlite/entitySyncRepo';
import { runSync, resolveConflictKeepLocal, resolveConflictKeepRemote } from './entitySync';
import { EntitySyncQuotaError } from './entitySyncClient';
import type {
  SyncPullChange,
  SyncPullResult,
  SyncPushEntity,
  SyncPushResult,
} from './entitySyncClient';

/**
 * In-memory stand-in for the deployed Worker, implementing the exact
 * push/pull contract of workers/entity-sync/src/index.ts so the orchestrator
 * can be exercised without HTTP.
 */
class FakeCentral {
  private rows = new Map<
    string,
    {
      kind: SyncPullChange['kind'];
      revision: number;
      contentXml: string;
      contentHash: string;
      deleted: boolean;
      seq: number;
    }
  >();

  private lastSeq = 0;

  /** When set, `push` throws a quota error once it has accepted this many entities. */
  quotaAfter = Infinity;
  private acceptedTotal = 0;

  /** Seed a central row directly (out-of-band, like the seed script). */
  seed(
    centralId: string,
    row: Omit<SyncPushEntity, 'localId' | 'baseRevision'> & { seq?: number },
  ) {
    this.lastSeq += 1;
    this.rows.set(centralId, {
      kind: row.kind,
      revision: 1,
      contentXml: row.contentXml,
      contentHash: row.contentHash,
      deleted: row.deleted ?? false,
      seq: row.seq ?? this.lastSeq,
    });
  }

  pull = async (since: number, limit = 500): Promise<SyncPullResult> => {
    const changes = [...this.rows.entries()]
      .filter(([, r]) => r.seq > since)
      .sort((a, b) => a[1].seq - b[1].seq)
      .slice(0, limit)
      .map(([centralId, r]) => ({
        centralId,
        kind: r.kind,
        revision: r.revision,
        contentXml: r.contentXml,
        contentHash: r.contentHash,
        deleted: r.deleted,
        seq: r.seq,
      }));
    return {
      changes,
      highSeq: changes.length > 0 ? changes[changes.length - 1]!.seq : since,
      hasMore: changes.length === limit,
    };
  };

  push = async (entities: SyncPushEntity[]): Promise<SyncPushResult> => {
    if (this.acceptedTotal >= this.quotaAfter) {
      throw new EntitySyncQuotaError('write quota reached');
    }
    const applied: SyncPushResult['applied'] = [];
    const reconciled: SyncPushResult['reconciled'] = [];
    const conflicts: SyncPushResult['conflicts'] = [];

    for (const e of entities) {
      const centralId = e.centralId ?? e.localId;
      const existing = this.rows.get(centralId);

      if (!existing) {
        this.lastSeq += 1;
        const revision = Math.max(e.baseRevision, 0) + 1;
        this.rows.set(centralId, {
          kind: e.kind,
          revision,
          contentXml: e.contentXml,
          contentHash: e.contentHash,
          deleted: e.deleted ?? false,
          seq: this.lastSeq,
        });
        applied.push({ localId: e.localId, centralId, revision, seq: this.lastSeq });
        continue;
      }
      if (existing.revision === e.baseRevision) {
        this.lastSeq += 1;
        existing.revision = e.baseRevision + 1;
        existing.contentXml = e.contentXml;
        existing.contentHash = e.contentHash;
        existing.deleted = e.deleted ?? false;
        existing.seq = this.lastSeq;
        applied.push({
          localId: e.localId,
          centralId,
          revision: existing.revision,
          seq: this.lastSeq,
        });
        continue;
      }
      if (existing.contentHash === e.contentHash && existing.deleted === (e.deleted ?? false)) {
        reconciled.push({
          localId: e.localId,
          centralId,
          revision: existing.revision,
          seq: existing.seq,
        });
        continue;
      }
      conflicts.push({
        localId: e.localId,
        centralId,
        serverRevision: existing.revision,
        serverHash: existing.contentHash,
        serverXml: existing.contentXml,
        serverDeleted: existing.deleted,
      });
    }
    this.acceptedTotal += applied.length + reconciled.length;
    return { applied, reconciled, conflicts, highSeq: this.lastSeq };
  };

  /** test helper: bump an entity's central revision out of band (simulates another device) */
  bumpOutOfBand(centralId: string, contentXml: string, contentHash: string): void {
    const row = this.rows.get(centralId)!;
    this.lastSeq += 1;
    row.revision += 1;
    row.contentXml = contentXml;
    row.contentHash = contentHash;
    row.seq = this.lastSeq;
  }
}

const freshRepo = () => {
  const repo = new EntitySqliteRepository(':memory:');
  repo.setMetadata('database_id', 'test-db');
  return repo;
};

const addPerson = (repo: EntitySqliteRepository, id: string, name: string) => {
  repo.createEntity({ id, kind: 'person' });
  repo.addName({ entityId: id, text: name, isPrimary: true });
};

describe('runSync', () => {
  it('pushes new local entities to central and marks them clean', async () => {
    const central = new FakeCentral();
    const repo = freshRepo();
    addPerson(repo, 'person-a', '張衡');
    addPerson(repo, 'person-b', '司馬遷');

    const result = await runSync({ repo, client: central });

    expect(result.pushedApplied).toBe(2);
    expect(result.pushedConflicts).toBe(0);
    expect(listDirtyForSync(repo)).toHaveLength(0);

    // A second device pulls both.
    const repoB = freshRepo();
    const resultB = await runSync({ repo: repoB, client: central });
    expect(resultB.pulledApplied).toBe(2);
    expect(repoB.getEntity('person-a')).not.toBeNull();
    expect(repoB.listNames('person-b').some((n) => n.text === '司馬遷')).toBe(true);
    expect(getSyncCursor(repoB)).toBe(resultB.cursor);
  });

  it('propagates an edit from one device to another (fast-forward)', async () => {
    const central = new FakeCentral();
    const repoA = freshRepo();
    addPerson(repoA, 'person-a', '張衡');
    await runSync({ repo: repoA, client: central });

    const repoB = freshRepo();
    await runSync({ repo: repoB, client: central });

    repoA.addName({ entityId: 'person-a', text: 'Zhang Heng' });
    const a2 = await runSync({ repo: repoA, client: central });
    expect(a2.pushedApplied).toBe(1);
    expect(a2.pushedConflicts).toBe(0);

    const b2 = await runSync({ repo: repoB, client: central });
    expect(b2.pulledApplied).toBe(1);
    expect(repoB.listNames('person-a').map((n) => n.text)).toEqual(
      expect.arrayContaining(['張衡', 'Zhang Heng']),
    );
    expect(listDirtyForSync(repoB)).toHaveLength(0);
  });

  it('opens a conflict when a pulled change collides with a dirty local edit', async () => {
    const central = new FakeCentral();
    const repoA = freshRepo();
    addPerson(repoA, 'person-a', '張衡');
    await runSync({ repo: repoA, client: central });
    const repoB = freshRepo();
    await runSync({ repo: repoB, client: central });

    // A edits and syncs; B edits differently and has NOT synced yet.
    repoA.addName({ entityId: 'person-a', text: 'from A' });
    await runSync({ repo: repoA, client: central });
    repoB.addName({ entityId: 'person-a', text: 'from B' });

    const b = await runSync({ repo: repoB, client: central });
    expect(b.pulledConflicts).toBe(1);
    expect(b.pushedApplied).toBe(0);
    expect(countOpenConflicts(repoB)).toBe(1);
    // local copy untouched
    expect(repoB.listNames('person-a').some((n) => n.text === 'from B')).toBe(true);
    expect(repoB.listNames('person-a').some((n) => n.text === 'from A')).toBe(false);

    const [conflict] = listOpenConflicts(repoB);
    expect(conflict!.reason).toBe('pull-collision');
    expect(conflict!.centralSnapshot).toContain('from A');
  });

  it('opens a conflict when the server rejects a stale-base push', async () => {
    const central = new FakeCentral();
    const repoA = freshRepo();
    addPerson(repoA, 'person-a', '張衡');
    await runSync({ repo: repoA, client: central });

    // Server moves ahead out of band, but the client's cursor is bumped past
    // that seq so its pull misses it — the push then arrives with a stale base.
    central.bumpOutOfBand('person-a', '<person xml:id="person-a">server</person>', 'server-hash');
    setSyncCursor(repoA, 999);

    repoA.addName({ entityId: 'person-a', text: 'client edit' });
    const a = await runSync({ repo: repoA, client: central });

    expect(a.pushedConflicts).toBe(1);
    expect(countOpenConflicts(repoA)).toBe(1);
    expect(listOpenConflicts(repoA)[0]!.reason).toBe('push-rejected');
  });

  it('round-trips a delete', async () => {
    const central = new FakeCentral();
    const repoA = freshRepo();
    addPerson(repoA, 'person-a', '張衡');
    await runSync({ repo: repoA, client: central });
    const repoB = freshRepo();
    await runSync({ repo: repoB, client: central });

    repoA.softDeleteEntity('person-a');
    const a = await runSync({ repo: repoA, client: central });
    expect(a.pushedApplied).toBe(1);

    const b = await runSync({ repo: repoB, client: central });
    expect(b.pulledApplied).toBe(1);
    expect(repoB.getEntity('person-a')!.deletedAt).not.toBeNull();
  });

  it('bails out when the abort signal is already set', async () => {
    const central = new FakeCentral();
    const repo = freshRepo();
    addPerson(repo, 'person-a', '張衡');
    const controller = new AbortController();
    controller.abort();
    await expect(runSync({ repo, client: central, signal: controller.signal })).rejects.toThrow(
      /aborted/i,
    );
  });

  it('reports progress for each pull page and push chunk', async () => {
    const central = new FakeCentral();
    const repoA = freshRepo();
    addPerson(repoA, 'person-a', '張衡');
    await runSync({ repo: repoA, client: central });

    const repoB = freshRepo();
    const events: string[] = [];
    await runSync({
      repo: repoB,
      client: central,
      onProgress: (p) => events.push(p.phase),
    });
    expect(events).toContain('pull');
  });

  it('is a no-op on the second run when nothing changed', async () => {
    const central = new FakeCentral();
    const repo = freshRepo();
    addPerson(repo, 'person-a', '張衡');
    await runSync({ repo, client: central });

    const again = await runSync({ repo, client: central });
    expect(again).toMatchObject({
      pulledApplied: 0,
      pulledConflicts: 0,
      pushedApplied: 0,
      pushedReconciled: 0,
      pushedConflicts: 0,
      openConflicts: 0,
    });
  });

  it('stops cleanly (no throw) when the server is out of write quota', async () => {
    const central = new FakeCentral();
    central.quotaAfter = 0; // refuse every push
    const repo = freshRepo();
    addPerson(repo, 'person-a', '甲');

    const result = await runSync({ repo, client: central });
    expect(result.stoppedEarly).toBe('write-quota');
    expect(result.pushedApplied).toBe(0);
    // the entity stays dirty for a later run; nothing was queued as a conflict
    expect(listDirtyForSync(repo).map((d) => d.localId)).toEqual(['person-a']);
    expect(countOpenConflicts(repo)).toBe(0);
  });

  it('adopts a seeded central row without a re-apply when local content already matches', async () => {
    // Emulate the out-of-band seed: the entity exists locally, an identical
    // row is on central at revision 1, and there's no local sync_state yet.
    const source = freshRepo();
    addPerson(source, 'person-x', '司馬遷');
    const central = new FakeCentral();
    central.seed('person-x', {
      kind: 'person',
      contentXml: exportLocalEntityXml(source, 'person-x')!,
      contentHash: localEntityHash(source, 'person-x')!,
    });

    const repo = freshRepo();
    addPerson(repo, 'person-x', '司馬遷');
    const before = repo.getEntity('person-x')!.revision;

    const result = await runSync({ repo, client: central });
    expect(result.pulledApplied).toBe(1);
    expect(result.pulledConflicts).toBe(0);
    // fast path: the local row's content was not re-imported, so its revision
    // is unchanged
    expect(repo.getEntity('person-x')!.revision).toBe(before);
    expect(listDirtyForSync(repo)).toHaveLength(0);
  });
});

describe('conflict resolution', () => {
  const setUpConflict = async () => {
    const central = new FakeCentral();
    const repoA = freshRepo();
    addPerson(repoA, 'person-a', '張衡');
    await runSync({ repo: repoA, client: central });
    const repoB = freshRepo();
    await runSync({ repo: repoB, client: central });

    repoA.addName({ entityId: 'person-a', text: 'from A' });
    await runSync({ repo: repoA, client: central });
    repoB.addName({ entityId: 'person-a', text: 'from B' });
    await runSync({ repo: repoB, client: central });

    return { central, repoB, conflictId: listOpenConflicts(repoB)[0]!.id };
  };

  it('keep-remote applies the server snapshot and clears the conflict', async () => {
    const { central, repoB, conflictId } = await setUpConflict();
    expect(resolveConflictKeepRemote(repoB, conflictId)).toBe(true);

    expect(countOpenConflicts(repoB)).toBe(0);
    expect(repoB.listNames('person-a').some((n) => n.text === 'from A')).toBe(true);
    expect(repoB.listNames('person-a').some((n) => n.text === 'from B')).toBe(false);

    const after = await runSync({ repo: repoB, client: central });
    expect(after.pushedConflicts).toBe(0);
    expect(listDirtyForSync(repoB)).toHaveLength(0);
  });

  it('keep-local re-pushes the local version and wins', async () => {
    const { central, repoB, conflictId } = await setUpConflict();
    expect(resolveConflictKeepLocal(repoB, conflictId)).toBe(true);
    expect(countOpenConflicts(repoB)).toBe(0);

    const after = await runSync({ repo: repoB, client: central });
    expect(after.pushedApplied).toBe(1);
    expect(after.pushedConflicts).toBe(0);
    expect(listDirtyForSync(repoB)).toHaveLength(0);

    // central now carries B's version
    const pulled = await central.pull(0);
    const row = pulled.changes.find((c) => c.centralId === 'person-a')!;
    expect(row.contentXml).toContain('from B');
  });
});
