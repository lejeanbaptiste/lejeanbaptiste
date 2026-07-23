import { addEntity, createEntitiesScaffold } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import { appendOrders, makeOrder } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityOrders';
import { setCentralMapping, getCentralId } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/concordance';
import {
  EntityStore,
  resolveEntityStorePaths,
  type EntityFileApi,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import {
  applyPendingCentralOrders,
  computeMergeDocket,
  resolveMergeSuggestion,
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
    resolveEntityStorePaths({ projectRoot: '/proj', entityStore: 'central', centralFolder: '/central' }),
  );
  const ctx: BridgeContext = { projectStore, centralStore, userStableId: USER };
  return { fs, ctx, projectStore };
};

describe('applyPendingCentralOrders', () => {
  it('repoints a PEDB mapping after an upstream central merge, and advances the cursor', async () => {
    const { fs, ctx, projectStore } = makeContext();

    const pedbDoc = await projectStore.loadEntities();
    const { element, id } = addEntity(pedbDoc, 'person', { name: '南齊書' });
    setCentralMapping(element, USER, 'person-old-central');
    await projectStore.saveEntities(pedbDoc);

    const order = makeOrder('cedb-1', { 'person-old-central': 'person-new-central' });
    fs.files.set('/central/entity-orders.jsonl', appendOrders('', [order]));

    const summary = await applyPendingCentralOrders(ctx);
    expect(summary).toEqual({ ordersApplied: 1, repointed: 1, cleared: 0 });

    const after = await projectStore.loadEntities();
    const afterItem = after.getElementsByTagName('person')[0]!;
    expect(afterItem.getAttribute('xml:id')).toBe(id);
    expect(getCentralId(afterItem, USER)).toBe('person-new-central');

    // second run is a no-op (cursor remembers the order)
    const again = await applyPendingCentralOrders(ctx);
    expect(again).toEqual({ ordersApplied: 0, repointed: 0, cleared: 0 });
  });

  it('clears a mapping when the central entity was deleted outright', async () => {
    const { fs, ctx, projectStore } = makeContext();
    const pedbDoc = await projectStore.loadEntities();
    const { element } = addEntity(pedbDoc, 'person', { name: '南齊書' });
    setCentralMapping(element, USER, 'person-old-central');
    await projectStore.saveEntities(pedbDoc);

    const order = makeOrder('cedb-1', { 'person-old-central': null });
    fs.files.set('/central/entity-orders.jsonl', appendOrders('', [order]));

    const summary = await applyPendingCentralOrders(ctx);
    expect(summary).toEqual({ ordersApplied: 1, repointed: 0, cleared: 1 });

    const after = await projectStore.loadEntities();
    const afterItem = after.getElementsByTagName('person')[0]!;
    expect(getCentralId(afterItem, USER)).toBeNull();
  });

  it('ignores orders from a different central database fingerprint', async () => {
    const { fs, ctx, projectStore } = makeContext();
    const pedbDoc = await projectStore.loadEntities();
    const { element } = addEntity(pedbDoc, 'person', { name: '南齊書' });
    setCentralMapping(element, USER, 'person-old-central');
    await projectStore.saveEntities(pedbDoc);

    const foreign = makeOrder('cedb-OTHER', { 'person-old-central': 'person-new-central' });
    fs.files.set('/central/entity-orders.jsonl', appendOrders('', [foreign]));

    const summary = await applyPendingCentralOrders(ctx);
    expect(summary).toEqual({ ordersApplied: 0, repointed: 0, cleared: 0 });

    const after = await projectStore.loadEntities();
    const afterItem = after.getElementsByTagName('person')[0]!;
    expect(getCentralId(afterItem, USER)).toBe('person-old-central');
  });

  it('is a no-op when there is no order log yet', async () => {
    const { ctx } = makeContext();
    const summary = await applyPendingCentralOrders(ctx);
    expect(summary).toEqual({ ordersApplied: 0, repointed: 0, cleared: 0 });
  });
});

describe('computeMergeDocket / resolveMergeSuggestion', () => {
  it('lists a pending suggestion with both sides compared, and the docket empties once merged', async () => {
    const { ctx } = makeContext();
    const cedbDoc = await ctx.centralStore.loadEntities();
    const a = addEntity(cedbDoc, 'work', { name: '南齊書', description: 'History of Southern Qi' }).id;
    const b = addEntity(cedbDoc, 'work', { name: '南齊書 (dup)', authorityIds: [{ type: 'Wikidata', value: 'Q123' }] }).id;
    await ctx.centralStore.saveEntities(cedbDoc);
    await ctx.centralStore.recordMergeSuggestion('pedb-1', [a, b]);

    const docket = await computeMergeDocket(ctx.centralStore);
    expect(docket).toHaveLength(1);
    expect(docket[0]!.sides.map((side) => side.id)).toEqual([a, b]);
    expect(docket[0]!.sides[0]!.fields.names.map((n) => n.text)).toEqual(['南齊書']);
    expect(docket[0]!.sides[1]!.fields.authorities).toEqual([{ type: 'Wikidata', value: 'Q123' }]);

    await resolveMergeSuggestion(ctx.centralStore, docket[0]!.suggestionId, {
      action: 'merge',
      keepId: a,
      dropId: b,
    });

    expect(await computeMergeDocket(ctx.centralStore)).toEqual([]);
    const afterDoc = await ctx.centralStore.loadEntities();
    expect(afterDoc.getElementsByTagName('bibl')).toHaveLength(1);

    // The merge also records a durable order other PEDBs converge against.
    const orders = await ctx.centralStore.readEntityOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0]!.remap).toEqual({ [b]: a });
  });

  it('drops off the docket when ignored, without touching either entity', async () => {
    const { ctx } = makeContext();
    const cedbDoc = await ctx.centralStore.loadEntities();
    const a = addEntity(cedbDoc, 'work', { name: '南齊書' }).id;
    const b = addEntity(cedbDoc, 'work', { name: '南齊書 (dup)' }).id;
    await ctx.centralStore.saveEntities(cedbDoc);
    await ctx.centralStore.recordMergeSuggestion('pedb-1', [a, b]);

    const docket = await computeMergeDocket(ctx.centralStore);
    await resolveMergeSuggestion(ctx.centralStore, docket[0]!.suggestionId, { action: 'ignore' });

    expect(await computeMergeDocket(ctx.centralStore)).toEqual([]);
    const afterDoc = await ctx.centralStore.loadEntities();
    expect(afterDoc.getElementsByTagName('bibl')).toHaveLength(2);
  });

  it('is empty when nothing has been suggested', async () => {
    const { ctx } = makeContext();
    expect(await computeMergeDocket(ctx.centralStore)).toEqual([]);
  });
});
