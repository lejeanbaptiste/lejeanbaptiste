import { getCentralId } from './concordance';
import { addEntity, createEntitiesScaffold, findEntity, parseEntities } from './entities';
import { findCentralByAuthority, findCentralByNameDates, promoteToCentral } from './promote';
import { readFields } from './reconcile';

const setup = () => ({
  pedbDoc: parseEntities(createEntitiesScaffold('pedb')),
  cedbDoc: parseEntities(createEntitiesScaffold('cedb')),
});

const USER = 'user-a';

describe('promoteToCentral', () => {
  it('mints a central record and links when there is no match', () => {
    const { pedbDoc, cedbDoc } = setup();
    const { id, element } = addEntity(pedbDoc, 'person', {
      name: '張衡',
      altNames: [{ text: '平子', type: 'courtesy' }],
      description: 'Han polymath',
      startYear: 78,
      authorityIds: [{ type: 'CBDB', value: '1762' }],
    });

    const result = promoteToCentral(pedbDoc, id, cedbDoc, USER);
    expect(result.created).toBe(true);
    expect(result.linked).toBe(true);
    expect(getCentralId(element, USER)).toBe(result.centralId);

    const central = readFields(findEntity(cedbDoc, result.centralId)!);
    expect(central.names.map((n) => n.text).sort()).toEqual(['平子', '張衡']);
    expect(central.description).toBe('Han polymath');
    expect(central.startYear).toBe(78);
    expect(central.authorities).toEqual([{ type: 'CBDB', value: '1762' }]);
  });

  it('links to an existing central record that shares an authority id (no duplicate)', () => {
    const { pedbDoc, cedbDoc } = setup();
    const central = addEntity(cedbDoc, 'person', {
      name: '張衡',
      authorityIds: [{ type: 'CBDB', value: '1762' }],
    });
    const { id, element } = addEntity(pedbDoc, 'person', {
      name: '張平子',
      authorityIds: [{ type: 'CBDB', value: '1762' }],
    });

    const result = promoteToCentral(pedbDoc, id, cedbDoc, USER);
    expect(result.created).toBe(false);
    expect(result.centralId).toBe(central.id);
    expect(getCentralId(element, USER)).toBe(central.id);
    // no duplicate minted
    expect(cedbDoc.getElementsByTagName('person')).toHaveLength(1);
  });

  it('is idempotent when already mapped', () => {
    const { pedbDoc, cedbDoc } = setup();
    const { id } = addEntity(pedbDoc, 'person', { name: '張衡', authorityIds: [{ type: 'CBDB', value: '1' }] });
    const first = promoteToCentral(pedbDoc, id, cedbDoc, USER);
    const second = promoteToCentral(pedbDoc, id, cedbDoc, USER);
    expect(second.created).toBe(false);
    expect(second.centralId).toBe(first.centralId);
    expect(cedbDoc.getElementsByTagName('person')).toHaveLength(1);
  });

  it('keeps separate mappings per user', () => {
    const { pedbDoc, cedbDoc } = setup();
    const { id, element } = addEntity(pedbDoc, 'person', { name: '張衡' });
    const a = promoteToCentral(pedbDoc, id, cedbDoc, 'user-a');
    const b = promoteToCentral(pedbDoc, id, cedbDoc, 'user-b');
    // different users, different central databases would differ; here same doc so
    // user-b finds no authority match and mints its own central record
    expect(getCentralId(element, 'user-a')).toBe(a.centralId);
    expect(getCentralId(element, 'user-b')).toBe(b.centralId);
  });
});

describe('findCentralByAuthority', () => {
  it('matches on shared authority within the same kind', () => {
    const cedbDoc = parseEntities(createEntitiesScaffold('cedb'));
    const person = addEntity(cedbDoc, 'person', { name: 'X', authorityIds: [{ type: 'Wikidata', value: 'Q1' }] });
    addEntity(cedbDoc, 'place', { name: 'Y', authorityIds: [{ type: 'Wikidata', value: 'Q1' }] });
    expect(findCentralByAuthority(cedbDoc, 'person', [{ type: 'Wikidata', value: 'Q1' }])).toBe(person.id);
    expect(findCentralByAuthority(cedbDoc, 'person', [{ type: 'CBDB', value: '9' }])).toBeNull();
  });
});

describe('findCentralByNameDates', () => {
  it('returns null when no candidate shares the name', () => {
    const cedbDoc = parseEntities(createEntitiesScaffold('cedb'));
    addEntity(cedbDoc, 'person', { name: '張衡', startYear: 78, endYear: 139 });
    expect(findCentralByNameDates(cedbDoc, 'person', '王充', 27, 97)).toBeNull();
  });

  it('returns null when more than one candidate matches the name (ambiguous)', () => {
    const cedbDoc = parseEntities(createEntitiesScaffold('cedb'));
    addEntity(cedbDoc, 'person', { name: '張衡' });
    addEntity(cedbDoc, 'person', { name: '張衡' });
    expect(findCentralByNameDates(cedbDoc, 'person', '張衡')).toBeNull();
  });

  it('matches the single candidate with the same name when neither side has dates', () => {
    const cedbDoc = parseEntities(createEntitiesScaffold('cedb'));
    const central = addEntity(cedbDoc, 'person', { name: '張衡' });
    expect(findCentralByNameDates(cedbDoc, 'person', '張衡')).toBe(central.id);
  });

  it('matches the single candidate with the same name and matching dates', () => {
    const cedbDoc = parseEntities(createEntitiesScaffold('cedb'));
    const central = addEntity(cedbDoc, 'person', { name: '張衡', startYear: 78, endYear: 139 });
    expect(findCentralByNameDates(cedbDoc, 'person', '張衡', 78, 139)).toBe(central.id);
  });

  it('matches when the candidate is missing dates the incoming entity has', () => {
    const cedbDoc = parseEntities(createEntitiesScaffold('cedb'));
    const central = addEntity(cedbDoc, 'person', { name: '張衡' });
    expect(findCentralByNameDates(cedbDoc, 'person', '張衡', 78, 139)).toBe(central.id);
  });

  it('rejects a same-named candidate whose dates disagree', () => {
    const cedbDoc = parseEntities(createEntitiesScaffold('cedb'));
    addEntity(cedbDoc, 'person', { name: '張衡', startYear: 78, endYear: 139 });
    expect(findCentralByNameDates(cedbDoc, 'person', '張衡', 100, 150)).toBeNull();
  });

  it('does not match across entity kinds', () => {
    const cedbDoc = parseEntities(createEntitiesScaffold('cedb'));
    addEntity(cedbDoc, 'place', { name: '張衡' });
    expect(findCentralByNameDates(cedbDoc, 'person', '張衡')).toBeNull();
  });
});

describe('promoteToCentral name+dates fallback', () => {
  it('links to a name+dates match when there is no shared authority id', () => {
    const { pedbDoc, cedbDoc } = setup();
    const central = addEntity(cedbDoc, 'person', { name: '張衡', startYear: 78, endYear: 139 });
    const { id, element } = addEntity(pedbDoc, 'person', { name: '張衡', startYear: 78, endYear: 139 });

    const result = promoteToCentral(pedbDoc, id, cedbDoc, USER);
    expect(result.created).toBe(false);
    expect(result.centralId).toBe(central.id);
    expect(getCentralId(element, USER)).toBe(central.id);
    expect(cedbDoc.getElementsByTagName('person')).toHaveLength(1);
  });

  it('prefers an authority match over a name+dates match when both would apply', () => {
    const { pedbDoc, cedbDoc } = setup();
    const byAuthority = addEntity(cedbDoc, 'person', {
      name: '張衡',
      startYear: 78,
      endYear: 139,
      authorityIds: [{ type: 'CBDB', value: '1762' }],
    });
    // A same-named, same-dated decoy with no authority id: the fallback alone
    // would be ambiguous between the two, but the authority match takes it
    // before the fallback is ever consulted.
    addEntity(cedbDoc, 'person', { name: '張衡', startYear: 78, endYear: 139 });
    const { id } = addEntity(pedbDoc, 'person', {
      name: '張衡',
      startYear: 78,
      endYear: 139,
      authorityIds: [{ type: 'CBDB', value: '1762' }],
    });

    const result = promoteToCentral(pedbDoc, id, cedbDoc, USER);
    expect(result.centralId).toBe(byAuthority.id);
    expect(cedbDoc.getElementsByTagName('person')).toHaveLength(2);
  });

  it('mints a new central record when the name+dates fallback is ambiguous', () => {
    const { pedbDoc, cedbDoc } = setup();
    addEntity(cedbDoc, 'person', { name: '張衡' });
    addEntity(cedbDoc, 'person', { name: '張衡' });
    const { id } = addEntity(pedbDoc, 'person', { name: '張衡' });

    const result = promoteToCentral(pedbDoc, id, cedbDoc, USER);
    expect(result.created).toBe(true);
    expect(cedbDoc.getElementsByTagName('person')).toHaveLength(3);
  });
});
