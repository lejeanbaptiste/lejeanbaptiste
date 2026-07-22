import {
  clearCentralMapping,
  getCentralId,
  listCentralMappings,
  setCentralMapping,
} from './concordance';
import { addEntity, createEntitiesScaffold, getEntityChanged, parseEntities } from './entities';

const makeEntity = (): Element => {
  const doc = parseEntities(createEntitiesScaffold());
  return addEntity(doc, 'person', { name: '張衡' }).element;
};

describe('concordance', () => {
  it('reads null when no mapping exists for a user', () => {
    expect(getCentralId(makeEntity(), 'user-a')).toBeNull();
  });

  it('sets, reads back, and updates a per-user mapping', () => {
    const item = makeEntity();
    expect(setCentralMapping(item, 'user-a', 'person-000042')).toBe(true);
    expect(getCentralId(item, 'user-a')).toBe('person-000042');
    // idempotent when unchanged
    expect(setCentralMapping(item, 'user-a', 'person-000042')).toBe(false);
    // updates in place
    expect(setCentralMapping(item, 'user-a', 'person-000099')).toBe(true);
    expect(getCentralId(item, 'user-a')).toBe('person-000099');
    expect(item.getElementsByTagName('idno')).toHaveLength(1);
  });

  it('keeps one row per user (two collaborators coexist)', () => {
    const item = makeEntity();
    setCentralMapping(item, 'user-a', 'person-000042');
    setCentralMapping(item, 'user-b', 'person-000007');
    expect(listCentralMappings(item)).toEqual([
      { userStableId: 'user-a', centralId: 'person-000042' },
      { userStableId: 'user-b', centralId: 'person-000007' },
    ]);
    expect(getCentralId(item, 'user-a')).toBe('person-000042');
    expect(getCentralId(item, 'user-b')).toBe('person-000007');
  });

  it('clears only the target user’s mapping', () => {
    const item = makeEntity();
    setCentralMapping(item, 'user-a', 'person-000042');
    setCentralMapping(item, 'user-b', 'person-000007');
    expect(clearCentralMapping(item, 'user-a')).toBe(true);
    expect(getCentralId(item, 'user-a')).toBeNull();
    expect(getCentralId(item, 'user-b')).toBe('person-000007');
    expect(clearCentralMapping(item, 'user-a')).toBe(false);
  });

  it('does not bump the entity changed timestamp (mapping is per-user metadata)', () => {
    const item = makeEntity();
    const before = getEntityChanged(item);
    setCentralMapping(item, 'user-a', 'person-000042');
    expect(getEntityChanged(item)).toBe(before);
  });
});
