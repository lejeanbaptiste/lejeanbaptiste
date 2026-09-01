import { EntitySqliteRepository } from './repository';
import {
  applyRemoteEntity,
  countOpenConflicts,
  exportLocalEntityXml,
  getOrCreateDeviceId,
  getSyncCursor,
  listDirtyForSync,
  listOpenConflicts,
  localEntityHash,
  openConflict,
  resolveConflict,
  setSyncCursor,
  upsertSyncState,
} from './entitySyncRepo';

const freshRepo = () => {
  const repo = new EntitySqliteRepository(':memory:');
  repo.setMetadata('database_id', 'test-db');
  return repo;
};

const addPerson = (repo: EntitySqliteRepository, id: string, name: string) => {
  const entity = repo.createEntity({ id, kind: 'person' });
  repo.addName({ entityId: id, text: name, isPrimary: true });
  return entity;
};

describe('cursor + device id', () => {
  it('cursor defaults to 0 and round-trips', () => {
    const repo = freshRepo();
    expect(getSyncCursor(repo)).toBe(0);
    setSyncCursor(repo, 42);
    expect(getSyncCursor(repo)).toBe(42);
  });

  it('device id is minted once and stable', () => {
    const repo = freshRepo();
    const first = getOrCreateDeviceId(repo);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(getOrCreateDeviceId(repo)).toBe(first);
  });
});

describe('listDirtyForSync', () => {
  it('reports a never-synced entity, then not after its sync_state matches', () => {
    const repo = freshRepo();
    addPerson(repo, 'person-1', '張衡');
    const revision = repo.getEntity('person-1')!.revision;

    const dirty = listDirtyForSync(repo);
    expect(dirty).toHaveLength(1);
    expect(dirty[0]).toMatchObject({ localId: 'person-1', kind: 'person', centralId: null, baseRevision: 0 });

    upsertSyncState(repo, {
      projectEntityId: 'person-1',
      centralEntityId: 'person-1',
      centralRevision: 1,
      projectRevision: revision,
      centralHash: 'h',
      projectHash: 'h',
    });
    expect(listDirtyForSync(repo)).toHaveLength(0);
  });

  it('goes dirty again after a local edit bumps the revision', () => {
    const repo = freshRepo();
    addPerson(repo, 'person-1', '張衡');
    upsertSyncState(repo, {
      projectEntityId: 'person-1',
      centralEntityId: 'person-1',
      centralRevision: 1,
      projectRevision: repo.getEntity('person-1')!.revision,
      centralHash: 'h',
      projectHash: 'h',
    });
    expect(listDirtyForSync(repo)).toHaveLength(0);

    repo.addName({ entityId: 'person-1', text: 'Zhang Heng' });
    const dirty = listDirtyForSync(repo);
    expect(dirty).toHaveLength(1);
    expect(dirty[0]!.centralId).toBe('person-1');
    expect(dirty[0]!.baseRevision).toBe(1);
  });

  it('excludes an entity that has an open conflict', () => {
    const repo = freshRepo();
    addPerson(repo, 'person-1', '張衡');
    openConflict(repo, {
      projectEntityId: 'person-1',
      centralEntityId: 'person-1',
      reason: 'pull-collision',
      projectRevision: 2,
      centralRevision: 3,
      projectSnapshot: '<person/>',
      centralSnapshot: '<person/>',
    });
    expect(listDirtyForSync(repo)).toHaveLength(0);
  });

  it('marks a soft-deleted entity as deleted', () => {
    const repo = freshRepo();
    addPerson(repo, 'person-1', '張衡');
    repo.softDeleteEntity('person-1');
    const dirty = listDirtyForSync(repo);
    expect(dirty).toHaveLength(1);
    expect(dirty[0]!.deleted).toBe(true);
  });
});

describe('conflicts', () => {
  it('opens once per entity pair, lists, counts, and resolves', () => {
    const repo = freshRepo();
    addPerson(repo, 'person-1', '張衡');
    const input = {
      projectEntityId: 'person-1',
      centralEntityId: 'person-1',
      reason: 'pull-collision',
      projectRevision: 2,
      centralRevision: 3,
      projectSnapshot: '<person>mine</person>',
      centralSnapshot: '<person>theirs</person>',
    };
    openConflict(repo, input);
    openConflict(repo, { ...input, reason: 'push-rejected' }); // no-op: already open
    expect(countOpenConflicts(repo)).toBe(1);

    const [conflict] = listOpenConflicts(repo);
    expect(conflict).toMatchObject({ projectEntityId: 'person-1', reason: 'pull-collision' });

    expect(resolveConflict(repo, conflict!.id)).toBe(true);
    expect(countOpenConflicts(repo)).toBe(0);
    expect(resolveConflict(repo, conflict!.id)).toBe(false); // already resolved
  });
});

describe('applyRemoteEntity', () => {
  it('creates a local entity that did not exist', () => {
    const source = freshRepo();
    addPerson(source, 'person-9', '司馬遷');
    const xml = exportLocalEntityXml(source, 'person-9')!;

    const repo = freshRepo();
    const { afterHash, projectRevision } = applyRemoteEntity(repo, {
      centralId: 'person-9',
      kind: 'person',
      contentXml: xml,
      deleted: false,
    });
    expect(repo.getEntity('person-9')).not.toBeNull();
    expect(repo.listNames('person-9').some((n) => n.text === '司馬遷')).toBe(true);
    expect(afterHash).toBe(localEntityHash(repo, 'person-9'));
    expect(projectRevision).toBe(repo.getEntity('person-9')!.revision);
  });

  it('replaces the content of an entity that already exists', () => {
    const source = freshRepo();
    addPerson(source, 'person-9', 'new name');
    const xml = exportLocalEntityXml(source, 'person-9')!;

    const repo = freshRepo();
    addPerson(repo, 'person-9', 'old name');
    applyRemoteEntity(repo, { centralId: 'person-9', kind: 'person', contentXml: xml, deleted: false });

    const names = repo.listNames('person-9').map((n) => n.text);
    expect(names).toContain('new name');
    expect(names).not.toContain('old name');
  });

  it('soft-deletes on a delete change', () => {
    const repo = freshRepo();
    addPerson(repo, 'person-9', '張衡');
    const { projectRevision } = applyRemoteEntity(repo, {
      centralId: 'person-9',
      kind: 'person',
      contentXml: '',
      deleted: true,
    });
    expect(repo.getEntity('person-9')!.deletedAt).not.toBeNull();
    expect(projectRevision).toBe(repo.getEntity('person-9')!.revision);
  });
});
