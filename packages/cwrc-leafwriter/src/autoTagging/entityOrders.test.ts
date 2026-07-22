import {
  appendOrders,
  composeRemap,
  makeOrder,
  ordersPathFor,
  parseOrders,
  pendingOrders,
  readAppliedOrderIds,
  readOrders,
  recordOrder,
  writeAppliedOrderIds,
  type EntityOrder,
} from './entityOrders';
import type { EntityFileApi } from './entityStore';

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

const order = (over: Partial<EntityOrder> & { dbId: string }): EntityOrder => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  when: over.when ?? '2026-07-23T00:00:00.000Z',
  dbId: over.dbId,
  remap: over.remap ?? {},
});

describe('order log format', () => {
  it('ordersPathFor is a sibling of entities.xml', () => {
    expect(ordersPathFor('/central/entities.xml')).toBe('/central/entity-orders.jsonl');
    expect(ordersPathFor('C:\\data\\entities.xml')).toBe('C:\\data\\entity-orders.jsonl');
  });

  it('round-trips orders through append/parse, skipping corrupt lines', () => {
    const a = makeOrder('db1', { 'person-1': 'person-2' }, '2026-01-01T00:00:00.000Z');
    const b = makeOrder('db1', { 'person-3': null }, '2026-01-02T00:00:00.000Z');
    const body = appendOrders(appendOrders('', [a]), [b]) + 'not json\n';
    const parsed = parseOrders(body);
    expect(parsed.map((o) => o.id)).toEqual([a.id, b.id]);
    expect(parsed[1]!.remap).toEqual({ 'person-3': null });
  });
});

describe('composeRemap', () => {
  it('follows merge chains and deletes across orders (chronological)', () => {
    const orders: EntityOrder[] = [
      order({ dbId: 'db1', when: '2026-01-01T00:00:00Z', remap: { a: 'b' } }),
      order({ dbId: 'db1', when: '2026-01-02T00:00:00Z', remap: { b: 'c' } }),
      order({ dbId: 'db1', when: '2026-01-03T00:00:00Z', remap: { d: null } }),
    ];
    expect(composeRemap(orders)).toEqual({ a: 'c', b: 'c', d: null });
  });

  it('repoints a chain into a later delete', () => {
    const orders: EntityOrder[] = [
      order({ dbId: 'db1', when: '2026-01-01T00:00:00Z', remap: { a: 'b' } }),
      order({ dbId: 'db1', when: '2026-01-02T00:00:00Z', remap: { b: null } }),
    ];
    expect(composeRemap(orders)).toEqual({ a: null, b: null });
  });

  it('sorts by when then id, independent of input order', () => {
    const later = order({ dbId: 'db1', id: 'z', when: '2026-01-02T00:00:00Z', remap: { b: 'c' } });
    const earlier = order({ dbId: 'db1', id: 'a', when: '2026-01-01T00:00:00Z', remap: { a: 'b' } });
    expect(composeRemap([later, earlier])).toEqual({ a: 'c', b: 'c' });
  });
});

describe('pendingOrders', () => {
  it('selects only same-db, not-yet-applied orders', () => {
    const orders: EntityOrder[] = [
      order({ dbId: 'db1', id: '1' }),
      order({ dbId: 'db2', id: '2' }),
      order({ dbId: 'db1', id: '3' }),
    ];
    expect(pendingOrders(orders, 'db1', new Set(['1'])).map((o) => o.id)).toEqual(['3']);
  });
});

describe('order log + cursor persistence', () => {
  it('records orders to the sibling log and reads them back', async () => {
    const fs = new FakeFs();
    const o = makeOrder('db1', { a: 'b' });
    await recordOrder(fs, '/central/entities.xml', o);
    expect(await readOrders(fs, '/central/entities.xml')).toEqual([o]);
  });

  it('round-trips the applied-id cursor', async () => {
    const fs = new FakeFs();
    await writeAppliedOrderIds(fs, '/proj/.ljb', new Set(['x', 'y']));
    expect(await readAppliedOrderIds(fs, '/proj/.ljb')).toEqual(new Set(['x', 'y']));
  });

  it('returns an empty applied set before any cursor is written', async () => {
    const fs = new FakeFs();
    expect(await readAppliedOrderIds(fs, '/proj/.ljb')).toEqual(new Set());
  });
});
