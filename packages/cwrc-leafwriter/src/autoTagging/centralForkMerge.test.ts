import { mergeForkedCentral } from './centralForkMerge';
import {
  addEntity,
  createEntitiesScaffold,
  findEntity,
  getEntityChanged,
  parseEntities,
  serializeEntities,
  touchEntity,
} from './entities';
import { readFields } from './reconcile';

/** A base CEDB with one shared entity, then two forks parsed from the same XML. */
const forkPair = () => {
  const base = parseEntities(createEntitiesScaffold('cedb'));
  const shared = addEntity(base, 'person', { name: '張衡', startYear: 78 });
  const xml = serializeEntities(base);
  return { a: parseEntities(xml), b: parseEntities(xml), sharedId: shared.id };
};

describe('mergeForkedCentral', () => {
  it('imports entities added only on the other fork', () => {
    const { a, b } = forkPair();
    const added = addEntity(b, 'place', { name: '洛陽' });
    const result = mergeForkedCentral(a, b);
    expect(result.imported).toBe(1);
    expect(findEntity(a, added.id)?.localName).toBe('place');
  });

  it('never treats absence as deletion (both forks keep their additions)', () => {
    const { a, b, sharedId } = forkPair();
    const onlyA = addEntity(a, 'person', { name: '王弼' });
    const onlyB = addEntity(b, 'person', { name: '李白' });
    mergeForkedCentral(a, b);
    expect(findEntity(a, sharedId)).toBeTruthy();
    expect(findEntity(a, onlyA.id)).toBeTruthy();
    expect(findEntity(a, onlyB.id)).toBeTruthy();
  });

  it('unions non-conflicting differences on the shared entity', () => {
    const { a, b, sharedId } = forkPair();
    const aItem = findEntity(a, sharedId)!;
    const bItem = findEntity(b, sharedId)!;
    // fork A gained an authority; fork B gained an alt name
    const idno = a.createElementNS('http://www.tei-c.org/ns/1.0', 'idno');
    idno.setAttribute('type', 'CBDB');
    idno.textContent = '1762';
    aItem.appendChild(idno);
    const alt = b.createElementNS('http://www.tei-c.org/ns/1.0', 'persName');
    alt.textContent = '平子';
    bItem.appendChild(alt);

    const result = mergeForkedCentral(a, b);
    expect(result.reconciled).toBe(1);
    const merged = readFields(findEntity(a, sharedId)!);
    expect(merged.names.map((n) => n.text).sort()).toEqual(['平子', '張衡']);
    expect(merged.authorities).toEqual([{ type: 'CBDB', value: '1762' }]);
  });

  it('adopts the newer timestamp on identical records', () => {
    const { a, b, sharedId } = forkPair();
    touchEntity(findEntity(a, sharedId)!, '2020-01-01T00:00:00Z');
    touchEntity(findEntity(b, sharedId)!, '2026-01-01T00:00:00Z');
    mergeForkedCentral(a, b);
    expect(getEntityChanged(findEntity(a, sharedId)!)).toBe('2026-01-01T00:00:00Z');
  });

  it('reports same-field disagreements as conflicts by default', () => {
    const { a, b, sharedId } = forkPair();
    findEntity(b, sharedId)!.getElementsByTagName('birth')[0]!.setAttribute('when', '0079');
    const result = mergeForkedCentral(a, b);
    expect(result.conflicts).toEqual([
      expect.objectContaining({ id: sharedId, field: 'startYear', pedbValue: 78, cedbValue: 79 }),
    ]);
    // our side untouched
    expect(readFields(findEntity(a, sharedId)!).startYear).toBe(78);
  });

  it('keepNewest resolves conflicts to the newer fork', () => {
    const { a, b, sharedId } = forkPair();
    findEntity(b, sharedId)!.getElementsByTagName('birth')[0]!.setAttribute('when', '0079');
    touchEntity(findEntity(a, sharedId)!, '2020-01-01T00:00:00Z');
    touchEntity(findEntity(b, sharedId)!, '2026-01-01T00:00:00Z');
    const result = mergeForkedCentral(a, b, { keepNewest: true });
    expect(result.conflicts).toHaveLength(0);
    expect(readFields(findEntity(a, sharedId)!).startYear).toBe(79);
  });
});
