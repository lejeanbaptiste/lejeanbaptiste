import {
  addEntity,
  createEntitiesScaffold,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import {
  appendOrders,
  makeOrder,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityOrders';
import {
  setCentralMapping,
  getCentralId,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/concordance';
import { SQLITE_REQUIRED_MESSAGE } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/sqliteRequired';
import {
  EntityStore,
  resolveEntityStorePaths,
  type EntityFileApi,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import {
  applyPendingCentralOrders,
  computeBridgeInbox,
  computeMergeDocket,
  promoteEntities,
  resolveMergeSuggestion,
  syncEntities,
  type BridgeContext,
} from './bridge';

const USER = 'user-a';

class FakeFs implements EntityFileApi {
  files = new Map<string, string>();
  dirs = new Set<string>();
  ensureDirectory = async (dir: string) => {
    this.dirs.add(dir);
  };
  pathExists = async (path: string) => this.files.has(path) || this.dirs.has(path);
  readFile = async (path: string) => {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`no such file: ${path}`);
    return content;
  };
  writeFile = async (path: string, content: string) => {
    this.files.set(path, content);
  };
}

const makeContext = () => {
  const fs = new FakeFs();
  fs.dirs.add('/proj');
  fs.dirs.add('/central');

  const cedbDoc = createEntitiesScaffold('cedb-1');
  fs.files.set('/central/entities.xml', cedbDoc);

  const projectStore = EntityStore.fromPaths(fs, resolveEntityStorePaths({ projectRoot: '/proj' }));
  const centralStore = EntityStore.fromPaths(
    fs,
    resolveEntityStorePaths({
      projectRoot: '/proj',
      entityStore: 'central',
      centralFolder: '/central',
    }),
  );
  const ctx: BridgeContext = { projectStore, centralStore, userStableId: USER };
  return { fs, ctx, projectStore };
};

describe('applyPendingCentralOrders', () => {
  it('fails loud when a pending remap would write without PEDB SQLite', async () => {
    const { fs, ctx, projectStore } = makeContext();

    const pedbDoc = await projectStore.loadEntities();
    const { element } = addEntity(pedbDoc, 'person', { name: '南齊書' });
    setCentralMapping(element, USER, 'person-old-central');
    await projectStore.saveEntities(pedbDoc, { allowSqliteFullReimport: true });

    const order = makeOrder('cedb-1', { 'person-old-central': 'person-new-central' });
    fs.files.set('/central/entity-orders.jsonl', appendOrders('', [order]));

    await expect(applyPendingCentralOrders(ctx)).rejects.toThrow(SQLITE_REQUIRED_MESSAGE);
    const after = await projectStore.loadEntities();
    expect(getCentralId(after.getElementsByTagName('person')[0]!, USER)).toBe('person-old-central');
  });

  it('fails loud when orders exist but CEDB fingerprint cannot come from SQLite', async () => {
    const { fs, ctx, projectStore } = makeContext();
    const pedbDoc = await projectStore.loadEntities();
    const { element } = addEntity(pedbDoc, 'person', { name: '南齊書' });
    setCentralMapping(element, USER, 'person-old-central');
    await projectStore.saveEntities(pedbDoc, { allowSqliteFullReimport: true });

    const foreign = makeOrder('cedb-OTHER', { 'person-old-central': 'person-new-central' });
    fs.files.set('/central/entity-orders.jsonl', appendOrders('', [foreign]));

    await expect(applyPendingCentralOrders(ctx)).rejects.toThrow(SQLITE_REQUIRED_MESSAGE);
  });

  it('is a no-op when there is no order log yet', async () => {
    const { ctx } = makeContext();
    const summary = await applyPendingCentralOrders(ctx);
    expect(summary).toEqual({ ordersApplied: 0, repointed: 0, cleared: 0 });
  });
});

describe('promoteEntities / syncEntities', () => {
  it('fails loud without SQLite', async () => {
    const { ctx, projectStore } = makeContext();
    const pedbDoc = await projectStore.loadEntities();
    const { id } = addEntity(pedbDoc, 'person', { name: '孔遺' });
    await projectStore.saveEntities(pedbDoc, { allowSqliteFullReimport: true });

    await expect(promoteEntities(ctx, [id])).rejects.toThrow(SQLITE_REQUIRED_MESSAGE);
    await expect(syncEntities(ctx, [{ pedbId: id, centralId: 'central-1' }])).rejects.toThrow(
      SQLITE_REQUIRED_MESSAGE,
    );
  });
});

describe('computeBridgeInbox / computeMergeDocket reads', () => {
  it('fails loud without SQLite for the inbox', async () => {
    const { ctx } = makeContext();
    await expect(computeBridgeInbox(ctx)).rejects.toThrow(SQLITE_REQUIRED_MESSAGE);
  });

  it('fails loud without SQLite for the merge docket', async () => {
    const { ctx } = makeContext();
    await ctx.centralStore.recordMergeSuggestion('pedb-1', ['a', 'b']);
    await expect(computeMergeDocket(ctx.centralStore)).rejects.toThrow(SQLITE_REQUIRED_MESSAGE);
  });
});

describe('computeMergeDocket / resolveMergeSuggestion', () => {
  it('fails loud on merge/delete without CEDB SQLite', async () => {
    const { ctx } = makeContext();
    const cedbDoc = await ctx.centralStore.loadEntities();
    const a = addEntity(cedbDoc, 'work', { name: '南齊書' }).id;
    const b = addEntity(cedbDoc, 'work', { name: '南齊書 (dup)' }).id;
    await ctx.centralStore.saveEntities(cedbDoc, { allowSqliteFullReimport: true });
    await ctx.centralStore.recordMergeSuggestion('pedb-1', [a, b]);

    await expect(computeMergeDocket(ctx.centralStore)).rejects.toThrow(SQLITE_REQUIRED_MESSAGE);

    await expect(
      resolveMergeSuggestion(ctx.centralStore, 'suggestion-missing-sqlite', {
        action: 'merge',
        keepId: a,
        dropId: b,
      }),
    ).rejects.toThrow(SQLITE_REQUIRED_MESSAGE);

    await expect(
      resolveMergeSuggestion(ctx.centralStore, 'suggestion-missing-sqlite', {
        action: 'delete',
        centralId: a,
      }),
    ).rejects.toThrow(SQLITE_REQUIRED_MESSAGE);
  });

  it('ignores a suggestion without needing SQLite panel reads', async () => {
    const { ctx } = makeContext();
    const cedbDoc = await ctx.centralStore.loadEntities();
    const a = addEntity(cedbDoc, 'work', { name: '南齊書' }).id;
    const b = addEntity(cedbDoc, 'work', { name: '南齊書 (dup)' }).id;
    await ctx.centralStore.saveEntities(cedbDoc, { allowSqliteFullReimport: true });
    const suggestion = await ctx.centralStore.recordMergeSuggestion('pedb-1', [a, b]);
    expect(suggestion).toBeTruthy();

    await resolveMergeSuggestion(ctx.centralStore, suggestion!.id, { action: 'ignore' });

    // Docket itself still requires SQLite — ignore only records JSONL.
    await expect(computeMergeDocket(ctx.centralStore)).rejects.toThrow(SQLITE_REQUIRED_MESSAGE);
    const afterDoc = await ctx.centralStore.loadEntities();
    expect(afterDoc.getElementsByTagName('bibl')).toHaveLength(2);
  });

  it('fails loud when asking for an empty docket without SQLite', async () => {
    const { ctx } = makeContext();
    await expect(computeMergeDocket(ctx.centralStore)).rejects.toThrow(SQLITE_REQUIRED_MESSAGE);
  });

  it('ignores a purge suggestion without needing SQLite panel reads', async () => {
    const { ctx } = makeContext();
    const cedbDoc = await ctx.centralStore.loadEntities();
    const a = addEntity(cedbDoc, 'work', { name: '南齊書' }).id;
    await ctx.centralStore.saveEntities(cedbDoc, { allowSqliteFullReimport: true });
    const suggestion = await ctx.centralStore.recordDeleteSuggestion('pedb-1', a);
    expect(suggestion).toBeTruthy();

    await resolveMergeSuggestion(ctx.centralStore, suggestion!.id, { action: 'ignore' });

    await expect(computeMergeDocket(ctx.centralStore)).rejects.toThrow(SQLITE_REQUIRED_MESSAGE);
    const afterDoc = await ctx.centralStore.loadEntities();
    expect(afterDoc.getElementsByTagName('bibl')).toHaveLength(1);
  });
});
