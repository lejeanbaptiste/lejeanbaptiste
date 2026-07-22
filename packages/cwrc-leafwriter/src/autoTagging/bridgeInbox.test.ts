import { bridgeAttentionCount, buildBridgeInbox } from './bridgeInbox';
import { setCentralMapping } from './concordance';
import { addEntity, createEntitiesScaffold, parseEntities, touchEntity } from './entities';
import { promoteToCentral } from './promote';

const USER = 'user-a';

const setup = () => ({
  pedbDoc: parseEntities(createEntitiesScaffold('pedb')),
  cedbDoc: parseEntities(createEntitiesScaffold('cedb')),
});

describe('buildBridgeInbox', () => {
  it('reports an unmapped project entity as unlinked', () => {
    const { pedbDoc, cedbDoc } = setup();
    addEntity(pedbDoc, 'person', { name: '張衡' });
    const report = buildBridgeInbox(pedbDoc, cedbDoc, USER);
    expect(report.unlinked.map((u) => u.name)).toEqual(['張衡']);
    expect(bridgeAttentionCount(report)).toBe(1);
  });

  it('reports a mapping to a missing central id as broken', () => {
    const { pedbDoc, cedbDoc } = setup();
    const { element } = addEntity(pedbDoc, 'person', { name: '張衡' });
    setCentralMapping(element, USER, 'person-does-not-exist');
    const report = buildBridgeInbox(pedbDoc, cedbDoc, USER);
    expect(report.broken).toEqual([
      { id: element.getAttribute('xml:id'), name: '張衡', kind: 'person', centralId: 'person-does-not-exist' },
    ]);
  });

  it('counts a linked, agreeing pair as in-sync', () => {
    const { pedbDoc, cedbDoc } = setup();
    const { id } = addEntity(pedbDoc, 'person', { name: '張衡', authorityIds: [{ type: 'CBDB', value: '1' }] });
    promoteToCentral(pedbDoc, id, cedbDoc, USER); // creates + links + copies fields
    const report = buildBridgeInbox(pedbDoc, cedbDoc, USER);
    expect(report.inSyncCount).toBe(1);
    expect(bridgeAttentionCount(report)).toBe(0);
  });

  it('reports a linked pair with non-conflicting differences as syncable', () => {
    const { pedbDoc, cedbDoc } = setup();
    const p = addEntity(pedbDoc, 'person', { name: '張衡', description: 'Han polymath' });
    const promoted = promoteToCentral(pedbDoc, p.id, cedbDoc, USER);
    // add a new authority on the project side only → non-conflicting diff
    const pItem = pedbDoc.getElementsByTagName('person')[0]!;
    const idno = pedbDoc.createElementNS('http://www.tei-c.org/ns/1.0', 'idno');
    idno.setAttribute('type', 'Wikidata');
    idno.textContent = 'Q11332';
    pItem.appendChild(idno);
    const report = buildBridgeInbox(pedbDoc, cedbDoc, USER);
    expect(report.syncable).toEqual([
      { id: p.id, name: '張衡', kind: 'person', centralId: promoted.centralId },
    ]);
    expect(report.conflicts).toHaveLength(0);
    expect(bridgeAttentionCount(report)).toBe(0); // syncable is routine, not attention
  });

  it('reports a linked pair that disagrees on a field as a conflict', () => {
    const { pedbDoc, cedbDoc } = setup();
    const p = addEntity(pedbDoc, 'person', { name: '張衡', startYear: 78 });
    const promoted = promoteToCentral(pedbDoc, p.id, cedbDoc, USER);
    // diverge the central record's birth year, and make the timestamps differ
    const cItem = cedbDoc.getElementsByTagName('person')[0]!;
    cItem.getElementsByTagName('birth')[0]!.setAttribute('when', '0079');
    touchEntity(cItem, '2026-01-01T00:00:00Z');
    const report = buildBridgeInbox(pedbDoc, cedbDoc, USER);
    expect(report.conflicts).toEqual([
      { id: p.id, name: '張衡', kind: 'person', centralId: promoted.centralId, fields: ['startYear'] },
    ]);
  });
});
