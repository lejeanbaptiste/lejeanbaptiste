import { createEntitiesScaffold } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import { appendOrders, makeOrder } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityOrders';
import {
  EntityStore,
  resolveEntityStorePaths,
  type EntityFileApi,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import type { KeyRemapFileOps } from './applyKeyRemap';
import { applyPendingOrders } from './applyOrders';

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

const makeStore = () => {
  const fs = new FakeFs();
  fs.dirs.add('/proj');
  fs.dirs.add('/central');
  fs.files.set('/central/entities.xml', createEntitiesScaffold('db1'));
  fs.files.set('/central/entity-projects.json', JSON.stringify({ version: 1, projects: ['/proj'] }));
  const paths = resolveEntityStorePaths({
    projectRoot: '/proj',
    entityStore: 'central',
    centralFolder: '/central',
  });
  return { fs, store: EntityStore.fromPaths(fs, paths) };
};

/** Corpus lives outside the entity-file api; drive it through injected ops. */
const corpusOps = (corpus: Map<string, string>): KeyRemapFileOps => ({
  listXmlFiles: async () => [...corpus.keys()],
  readFile: async (p) => corpus.get(p)!,
  writeFile: async (p, c) => {
    corpus.set(p, c);
  },
});

describe('applyPendingOrders', () => {
  it('applies an order recorded on another machine and advances the cursor', async () => {
    const { fs, store } = makeStore();
    const order = makeOrder('db1', { a: 'b' }, '2026-07-23T00:00:00.000Z');
    fs.files.set('/central/entity-orders.jsonl', appendOrders('', [order]));
    const corpus = new Map([['/proj/ch1.xml', '<persName key="a">張衡</persName>']]);

    const result = await applyPendingOrders(store, corpusOps(corpus));
    expect(result.ordersApplied).toBe(1);
    expect(result.summary?.keysUpdated).toBe(1);
    expect(corpus.get('/proj/ch1.xml')).toBe('<persName key="b">張衡</persName>');

    // second run is a no-op (cursor remembers it)
    const again = await applyPendingOrders(store, corpusOps(corpus));
    expect(again.ordersApplied).toBe(0);
  });

  it('ignores orders from a different database fingerprint', async () => {
    const { fs, store } = makeStore();
    const foreign = makeOrder('db-OTHER', { a: 'b' });
    fs.files.set('/central/entity-orders.jsonl', appendOrders('', [foreign]));
    const corpus = new Map([['/proj/ch1.xml', '<persName key="a">張衡</persName>']]);

    const result = await applyPendingOrders(store, corpusOps(corpus));
    expect(result.ordersApplied).toBe(0);
    expect(corpus.get('/proj/ch1.xml')).toBe('<persName key="a">張衡</persName>');
  });

  it('is idempotent even without a cursor (replay is a no-op on rewritten files)', async () => {
    const { fs, store } = makeStore();
    const order = makeOrder('db1', { a: 'b' });
    fs.files.set('/central/entity-orders.jsonl', appendOrders('', [order]));
    // corpus already rewritten (as if pulled from the other machine)
    const corpus = new Map([['/proj/ch1.xml', '<persName key="b">張衡</persName>']]);

    const result = await applyPendingOrders(store, corpusOps(corpus));
    expect(result.ordersApplied).toBe(1);
    expect(result.summary?.filesChanged).toBe(0);
    expect(corpus.get('/proj/ch1.xml')).toBe('<persName key="b">張衡</persName>');
  });
});
