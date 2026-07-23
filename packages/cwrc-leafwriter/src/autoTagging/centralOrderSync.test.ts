import { applyCentralRemapToPedb, pendingCentralRemap } from './centralOrderSync';
import { getCentralId, setCentralMapping } from './concordance';
import { addEntity, createEntitiesScaffold, parseEntities } from './entities';
import { makeOrder } from './entityOrders';

const USER = 'user-a';

const setup = () => ({
  pedbDoc: parseEntities(createEntitiesScaffold('pedb')),
});

describe('pendingCentralRemap', () => {
  it('composes only orders recorded against the given dbId', () => {
    const merge = makeOrder('cedb-1', { 'person-A': 'person-B' }, '2026-01-01T00:00:00.000Z');
    const otherDb = makeOrder('cedb-2', { 'person-X': 'person-Y' }, '2026-01-01T00:00:00.000Z');
    const { pending, remap } = pendingCentralRemap([merge, otherDb], 'cedb-1', new Set());
    expect(pending).toEqual([merge]);
    expect(remap).toEqual({ 'person-A': 'person-B' });
  });

  it('skips orders already applied', () => {
    const merge = makeOrder('cedb-1', { 'person-A': 'person-B' });
    const { pending, remap } = pendingCentralRemap([merge], 'cedb-1', new Set([merge.id]));
    expect(pending).toEqual([]);
    expect(remap).toEqual({});
  });

  it('resolves a merge-then-merge chain in one pass', () => {
    const first = makeOrder('cedb-1', { 'person-A': 'person-B' }, '2026-01-01T00:00:00.000Z');
    const second = makeOrder('cedb-1', { 'person-B': 'person-C' }, '2026-01-02T00:00:00.000Z');
    const { remap } = pendingCentralRemap([second, first], 'cedb-1', new Set());
    expect(remap).toEqual({ 'person-A': 'person-C', 'person-B': 'person-C' });
  });
});

describe('applyCentralRemapToPedb', () => {
  it('repoints a mapping to the merge survivor', () => {
    const { pedbDoc } = setup();
    const { element, id } = addEntity(pedbDoc, 'person', { name: '南齊書' });
    setCentralMapping(element, USER, 'person-old-central');

    const result = applyCentralRemapToPedb(
      pedbDoc,
      { 'person-old-central': 'person-new-central' },
      USER,
    );

    expect(result.repointed).toEqual([
      { id, name: '南齊書', from: 'person-old-central', to: 'person-new-central' },
    ]);
    expect(result.cleared).toEqual([]);
    expect(getCentralId(element, USER)).toBe('person-new-central');
  });

  it('clears a mapping when the central entity was deleted outright (no survivor)', () => {
    const { pedbDoc } = setup();
    const { element, id } = addEntity(pedbDoc, 'person', { name: '南齊書' });
    setCentralMapping(element, USER, 'person-old-central');

    const result = applyCentralRemapToPedb(pedbDoc, { 'person-old-central': null }, USER);

    expect(result.cleared).toEqual([
      { id, name: '南齊書', from: 'person-old-central', to: null },
    ]);
    expect(getCentralId(element, USER)).toBeNull();
  });

  it('leaves unrelated mappings untouched', () => {
    const { pedbDoc } = setup();
    const { element } = addEntity(pedbDoc, 'person', { name: '南齊書' });
    setCentralMapping(element, USER, 'person-unrelated');

    const result = applyCentralRemapToPedb(
      pedbDoc,
      { 'person-old-central': 'person-new-central' },
      USER,
    );

    expect(result.repointed).toEqual([]);
    expect(result.cleared).toEqual([]);
    expect(getCentralId(element, USER)).toBe('person-unrelated');
  });

  it('only repoints the given user, leaving a collaborator mapping alone', () => {
    const { pedbDoc } = setup();
    const { element } = addEntity(pedbDoc, 'person', { name: '南齊書' });
    setCentralMapping(element, USER, 'person-old-central');
    setCentralMapping(element, 'user-b', 'person-old-central');

    applyCentralRemapToPedb(pedbDoc, { 'person-old-central': 'person-new-central' }, USER);

    expect(getCentralId(element, USER)).toBe('person-new-central');
    expect(getCentralId(element, 'user-b')).toBe('person-old-central');
  });

  it('is a no-op with an empty remap', () => {
    const { pedbDoc } = setup();
    const { element } = addEntity(pedbDoc, 'person', { name: '南齊書' });
    setCentralMapping(element, USER, 'person-old-central');

    const result = applyCentralRemapToPedb(pedbDoc, {}, USER);

    expect(result).toEqual({ repointed: [], cleared: [] });
    expect(getCentralId(element, USER)).toBe('person-old-central');
  });
});
