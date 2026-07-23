import { addEntity, createEntitiesScaffold, findEntity, parseEntities } from './entities';
import { getCentralId, setCentralMapping } from './concordance';
import {
  addEntityName,
  attachAuthority,
  deleteEntity,
  detachAuthority,
  findAuthorityDuplicates,
  listEntities,
  markDuplicateIntentional,
  mergeEntities,
  normalizeAuthorityValue,
  removeEntityName,
  renameEntityName,
  setEntityDescription,
  setFamilyName,
  setGivenName,
  setNameType,
  setRomanizedName,
  taggableEntityNames,
} from './entityOps';

const makeDoc = () => parseEntities(createEntitiesScaffold('test-db'));

describe('listEntities', () => {
  it('summarizes id, kind, names, description, and authorities', () => {
    const doc = makeDoc();
    addEntity(doc, 'person', {
      name: '王導',
      description: '東晉丞相',
      authorityIds: [
        { type: 'Wikidata', value: 'http://www.wikidata.org/entity/Q3274914' },
        { type: 'CBDB', value: '25788' },
      ],
    });
    addEntity(doc, 'place', { name: '建康' });

    const entities = listEntities(doc);
    expect(entities).toHaveLength(2);
    expect(entities[0]).toMatchObject({
      kind: 'person',
      names: ['王導'],
      description: '東晉丞相',
    });
    expect(entities[0]!.authorities).toEqual([
      { type: 'Wikidata', value: 'http://www.wikidata.org/entity/Q3274914' },
      { type: 'CBDB', value: '25788' },
    ]);
    expect(entities[1]).toMatchObject({ kind: 'place', names: ['建康'] });
  });

  it('excludes the per-user ljb-central concordance row from authorities', () => {
    const doc = makeDoc();
    const { element } = addEntity(doc, 'person', {
      name: '王導',
      authorityIds: [{ type: 'CBDB', value: '25788' }],
    });
    setCentralMapping(element, 'user-a', 'person-central-1');

    expect(listEntities(doc)[0]!.authorities).toEqual([{ type: 'CBDB', value: '25788' }]);
  });
});

describe('descriptions and names', () => {
  it('sets, replaces, and clears the description note', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '桓溫' });

    setEntityDescription(doc, id, '東晉權臣');
    expect(listEntities(doc)[0]!.description).toBe('東晉權臣');

    setEntityDescription(doc, id, '大司馬');
    expect(listEntities(doc)[0]!.description).toBe('大司馬');

    setEntityDescription(doc, id, '  ');
    expect(listEntities(doc)[0]!.description).toBeNull();
  });

  it('sets, replaces, and clears family/given names independently of the display name', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '桓溫' });
    expect(listEntities(doc)[0]).toMatchObject({ familyName: null, givenName: null });

    setFamilyName(doc, id, '桓');
    setGivenName(doc, id, '溫');
    let entity = listEntities(doc)[0]!;
    expect(entity.familyName).toBe('桓');
    expect(entity.givenName).toBe('溫');
    expect(entity.names).toEqual(['桓溫']);

    setFamilyName(doc, id, '  ');
    entity = listEntities(doc)[0]!;
    expect(entity.familyName).toBeNull();
    expect(entity.givenName).toBe('溫');
  });

  it('adds alternative names without duplicating, keeping the first as display', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '劉裕' });

    expect(addEntityName(doc, id, '宋武帝')).toBe(true);
    expect(addEntityName(doc, id, '宋武帝')).toBe(false);
    expect(listEntities(doc)[0]!.names).toEqual(['劉裕', '宋武帝']);
  });

  it('removes an alternative name but never the last one', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '劉裕' });
    addEntityName(doc, id, '宋武帝');

    expect(removeEntityName(doc, id, '宋武帝')).toBe(true);
    expect(removeEntityName(doc, id, '劉裕')).toBe(false);
    expect(listEntities(doc)[0]!.names).toEqual(['劉裕']);
  });
});

describe('name attributes', () => {
  it('summarizes nameEntries with lang/type and picks the -Latn name as romanized', () => {
    const doc = makeDoc();
    addEntity(doc, 'person', {
      name: '張衡',
      nameLang: 'zh-Hant',
      romanizedName: 'Zhang Heng',
      altNames: [{ text: '平子', type: 'courtesy' }],
    });
    addEntity(doc, 'person', { name: '王導' }); // legacy shape

    const [modern, legacy] = listEntities(doc);
    expect(modern!.nameEntries).toEqual([
      { text: '張衡', lang: 'zh-Hant', type: 'primary' },
      { text: 'Zhang Heng', lang: 'zh-Latn', type: null },
      { text: '平子', lang: null, type: 'courtesy' },
    ]);
    expect(modern!.romanized).toBe('Zhang Heng');
    expect(legacy!.nameEntries).toEqual([{ text: '王導', lang: null, type: null }]);
    expect(legacy!.romanized).toBeNull();
  });

  it('addEntityName writes lang/type and upgrades attribute-less duplicates in place', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '張衡' });

    expect(addEntityName(doc, id, '平子', { type: 'courtesy', lang: 'zh-Hant' })).toBe(true);
    expect(listEntities(doc)[0]!.nameEntries[1]).toEqual({
      text: '平子',
      lang: 'zh-Hant',
      type: 'courtesy',
    });

    // duplicate text: no new element, but the legacy primary gets upgraded
    expect(addEntityName(doc, id, '張衡', { lang: 'zh-Hant', type: 'primary' })).toBe(false);
    expect(listEntities(doc)[0]!.nameEntries[0]).toEqual({
      text: '張衡',
      lang: 'zh-Hant',
      type: 'primary',
    });
    expect(listEntities(doc)[0]!.names).toEqual(['張衡', '平子']);
  });

  it('setRomanizedName creates after the first name, updates in place, and clears', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '張衡', nameLang: 'zh-Hant' });
    addEntityName(doc, id, '平子');

    setRomanizedName(doc, id, 'Zhang Heng', 'zh-Hant');
    expect(listEntities(doc)[0]!.names).toEqual(['張衡', 'Zhang Heng', '平子']);
    expect(listEntities(doc)[0]!.romanized).toBe('Zhang Heng');

    setRomanizedName(doc, id, 'Chang Heng', 'zh-Hant');
    expect(listEntities(doc)[0]!.names).toEqual(['張衡', 'Chang Heng', '平子']);

    setRomanizedName(doc, id, '  ', 'zh-Hant');
    expect(listEntities(doc)[0]!.names).toEqual(['張衡', '平子']);
    expect(listEntities(doc)[0]!.romanized).toBeNull();
  });

  it('setNameType sets, clears, and creates typed names', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '張衡' });
    addEntityName(doc, id, '平子');

    setNameType(doc, id, '平子', 'courtesy');
    expect(listEntities(doc)[0]!.nameEntries[1]!.type).toBe('courtesy');

    setNameType(doc, id, '平子', null);
    expect(listEntities(doc)[0]!.nameEntries[1]!.type).toBeNull();

    // unknown name text + a type creates the name
    setNameType(doc, id, '西鄂侯', 'posthumous', 'zh-Hant');
    expect(listEntities(doc)[0]!.nameEntries[2]).toEqual({
      text: '西鄂侯',
      lang: 'zh-Hant',
      type: 'posthumous',
    });
  });

  it('setNameType syncs family and given names to their note fields', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '江祀' });

    setNameType(doc, id, '江', 'family');
    expect(listEntities(doc)[0]).toMatchObject({
      familyName: '江',
      givenName: null,
      nameEntries: expect.arrayContaining([expect.objectContaining({ text: '江', type: 'family' })]),
    });

    setNameType(doc, id, '祀', 'given');
    expect(listEntities(doc)[0]).toMatchObject({
      familyName: '江',
      givenName: '祀',
      nameEntries: expect.arrayContaining([expect.objectContaining({ text: '祀', type: 'given' })]),
    });

    setNameType(doc, id, '祀', null);
    expect(listEntities(doc)[0]).toMatchObject({ givenName: null });
    expect(listEntities(doc)[0]!.nameEntries.find((entry) => entry.text === '祀')!.type).toBeNull();
  });

  it('taggableEntityNames excludes courtesy names by default but keeps legacy untyped ones', () => {
    const doc = makeDoc();
    addEntity(doc, 'person', {
      name: '張衡',
      nameLang: 'zh-Hant',
      romanizedName: 'Zhang Heng',
      altNames: [{ text: '平子', type: 'courtesy' }, { text: '张衡' }],
    });
    const entity = listEntities(doc)[0]!;
    expect(taggableEntityNames(entity)).toEqual(['張衡', 'Zhang Heng', '张衡']);
    expect(taggableEntityNames(entity, [])).toEqual(['張衡', 'Zhang Heng', '平子', '张衡']);
    expect(taggableEntityNames(entity, ['courtesy', 'variant'])).toEqual([
      '張衡',
      'Zhang Heng',
      '张衡',
    ]);
  });

  it('renameEntityName keeps the first name element attributes', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '張衡', nameLang: 'zh-Hant' });
    renameEntityName(doc, id, '张衡');
    const first = findEntity(doc, id)!.getElementsByTagName('persName')[0]!;
    expect(first.textContent).toBe('张衡');
    expect(first.getAttribute('xml:lang')).toBe('zh-Hant');
    expect(first.getAttribute('type')).toBe('primary');
  });
});

describe('authority attach/detach', () => {
  it('attaches and detaches idnos, refusing duplicates', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '苻堅' });
    const ref = { type: 'Wikidata', value: 'http://www.wikidata.org/entity/Q967998' };

    expect(attachAuthority(doc, id, ref)).toBe(true);
    expect(attachAuthority(doc, id, ref)).toBe(false);
    expect(listEntities(doc)[0]!.authorities).toEqual([ref]);

    expect(detachAuthority(doc, id, ref)).toBe(true);
    expect(detachAuthority(doc, id, ref)).toBe(false);
    expect(listEntities(doc)[0]!.authorities).toEqual([]);
  });
});

describe('mergeEntities', () => {
  it('unions names, idnos, and description into the keeper and removes the dropped', () => {
    const doc = makeDoc();
    const keep = addEntity(doc, 'person', {
      name: '王導',
      authorityIds: [{ type: 'CBDB', value: '25788' }],
    }).id;
    const drop = addEntity(doc, 'person', {
      name: '王茂弘',
      description: '東晉丞相',
      authorityIds: [
        { type: 'CBDB', value: '25788' },
        { type: 'Wikidata', value: 'http://www.wikidata.org/entity/Q3274914' },
      ],
    }).id;

    const result = mergeEntities(doc, keep, [drop]);
    expect(result.remap).toEqual({ [drop]: keep });

    const entities = listEntities(doc);
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      id: keep,
      names: ['王導', '王茂弘'],
      description: '東晉丞相',
    });
    expect(entities[0]!.authorities).toEqual([
      { type: 'CBDB', value: '25788' },
      { type: 'Wikidata', value: 'http://www.wikidata.org/entity/Q3274914' },
    ]);
  });

  it('preserves xml:lang and type on merged names, demoting a dropped primary to variant', () => {
    const doc = makeDoc();
    const keep = addEntity(doc, 'person', { name: '張衡', nameLang: 'zh-Hant' }).id;
    const drop = addEntity(doc, 'person', {
      name: '张衡',
      nameLang: 'zh-Hans',
      romanizedName: 'Zhang Heng',
      altNames: [{ text: '平子', type: 'courtesy' }],
    }).id;

    mergeEntities(doc, keep, [drop]);
    expect(listEntities(doc)[0]!.nameEntries).toEqual([
      { text: '張衡', lang: 'zh-Hant', type: 'primary' },
      { text: '张衡', lang: 'zh-Hans', type: 'variant' },
      { text: 'Zhang Heng', lang: 'zh-Latn', type: null },
      { text: '平子', lang: null, type: 'courtesy' },
    ]);
    expect(listEntities(doc)[0]!.romanized).toBe('Zhang Heng');
  });

  it('keeps the keeper description when both have one', () => {
    const doc = makeDoc();
    const keep = addEntity(doc, 'person', { name: 'A', description: 'keeper' }).id;
    const drop = addEntity(doc, 'person', { name: 'B', description: 'dropped' }).id;

    mergeEntities(doc, keep, [drop]);
    expect(listEntities(doc)[0]!.description).toBe('keeper');
  });

  it('carries family/given names from the dropped entity only when the keeper lacks them', () => {
    const doc = makeDoc();
    const keep = addEntity(doc, 'person', { name: '王導' }).id;
    const drop = addEntity(doc, 'person', { name: '王茂弘' }).id;
    setFamilyName(doc, drop, '王');
    setGivenName(doc, drop, '導');
    setGivenName(doc, keep, '既有');

    mergeEntities(doc, keep, [drop]);
    const entity = listEntities(doc)[0]!;
    expect(entity.familyName).toBe('王');
    expect(entity.givenName).toBe('既有');
  });

  it('refuses to merge entities of different kinds', () => {
    const doc = makeDoc();
    const keep = addEntity(doc, 'person', { name: 'A' }).id;
    const drop = addEntity(doc, 'place', { name: 'B' }).id;

    expect(() => mergeEntities(doc, keep, [drop])).toThrow(/different kinds/);
  });

  it('merges several dropped entities at once', () => {
    const doc = makeDoc();
    const keep = addEntity(doc, 'person', { name: 'A' }).id;
    const drop1 = addEntity(doc, 'person', { name: 'B' }).id;
    const drop2 = addEntity(doc, 'person', { name: 'C' }).id;

    const { remap } = mergeEntities(doc, keep, [drop1, drop2]);
    expect(remap).toEqual({ [drop1]: keep, [drop2]: keep });
    expect(listEntities(doc)).toHaveLength(1);
    expect(listEntities(doc)[0]!.names).toEqual(['A', 'B', 'C']);
  });

  it('returns no central conflicts when neither side has a ljb-central mapping', () => {
    const doc = makeDoc();
    const keep = addEntity(doc, 'person', { name: 'A' }).id;
    const drop = addEntity(doc, 'person', { name: 'B' }).id;
    const { centralConflicts } = mergeEntities(doc, keep, [drop]);
    expect(centralConflicts).toEqual([]);
  });

  it('transfers a ljb-central mapping the keeper lacks from the dropped entity', () => {
    const doc = makeDoc();
    const keepEl = addEntity(doc, 'person', { name: 'A' });
    const dropEl = addEntity(doc, 'person', { name: 'B' });
    setCentralMapping(dropEl.element, 'user-a', 'person-central-1');

    const { centralConflicts } = mergeEntities(doc, keepEl.id, [dropEl.id]);
    expect(centralConflicts).toEqual([]);
    const keeper = findEntity(doc, keepEl.id)!;
    expect(getCentralId(keeper, 'user-a')).toBe('person-central-1');
  });

  it('keeps the keeper mapping and reports a conflict when both sides map the same user to different central ids', () => {
    const doc = makeDoc();
    const keepEl = addEntity(doc, 'person', { name: 'A' });
    const dropEl = addEntity(doc, 'person', { name: 'B' });
    setCentralMapping(keepEl.element, 'user-a', 'person-central-1');
    setCentralMapping(dropEl.element, 'user-a', 'person-central-2');

    const { centralConflicts } = mergeEntities(doc, keepEl.id, [dropEl.id]);
    expect(centralConflicts).toEqual([
      { userStableId: 'user-a', keptCentralId: 'person-central-1', droppedCentralId: 'person-central-2' },
    ]);
    const keeper = findEntity(doc, keepEl.id)!;
    expect(getCentralId(keeper, 'user-a')).toBe('person-central-1');
  });

  it('does not duplicate a ljb-central mapping when both sides already agree', () => {
    const doc = makeDoc();
    const keepEl = addEntity(doc, 'person', { name: 'A' });
    const dropEl = addEntity(doc, 'person', { name: 'B' });
    setCentralMapping(keepEl.element, 'user-a', 'person-central-1');
    setCentralMapping(dropEl.element, 'user-a', 'person-central-1');

    const { centralConflicts } = mergeEntities(doc, keepEl.id, [dropEl.id]);
    expect(centralConflicts).toEqual([]);
    const keeper = findEntity(doc, keepEl.id)!;
    expect(getCentralId(keeper, 'user-a')).toBe('person-central-1');
  });

  it('keeps different users mappings independent, transferring and conflicting separately', () => {
    const doc = makeDoc();
    const keepEl = addEntity(doc, 'person', { name: 'A' });
    const dropEl = addEntity(doc, 'person', { name: 'B' });
    setCentralMapping(keepEl.element, 'user-a', 'person-central-1');
    setCentralMapping(dropEl.element, 'user-a', 'person-central-2'); // conflicts
    setCentralMapping(dropEl.element, 'user-b', 'person-central-9'); // keeper lacks this — transfers

    const { centralConflicts } = mergeEntities(doc, keepEl.id, [dropEl.id]);
    expect(centralConflicts).toEqual([
      { userStableId: 'user-a', keptCentralId: 'person-central-1', droppedCentralId: 'person-central-2' },
    ]);
    const keeper = findEntity(doc, keepEl.id)!;
    expect(getCentralId(keeper, 'user-a')).toBe('person-central-1');
    expect(getCentralId(keeper, 'user-b')).toBe('person-central-9');
  });

  it('never copies the ljb-central row as a generic authority idno', () => {
    const doc = makeDoc();
    const keepEl = addEntity(doc, 'person', { name: 'A' });
    const dropEl = addEntity(doc, 'person', { name: 'B' });
    setCentralMapping(dropEl.element, 'user-a', 'person-central-1');

    mergeEntities(doc, keepEl.id, [dropEl.id]);
    // authorities() already excludes ljb-central (see the listEntities test below);
    // this asserts the merge path never routes it through attachAuthority either.
    expect(listEntities(doc)[0]!.authorities).toEqual([]);
  });
});

describe('deleteEntity', () => {
  it('removes the entity from the document', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: 'A' });
    deleteEntity(doc, id);
    expect(listEntities(doc)).toHaveLength(0);
  });

  it('throws for an unknown id', () => {
    expect(() => deleteEntity(makeDoc(), 'person-999999')).toThrow(/not found/);
  });
});

describe('normalizeAuthorityValue', () => {
  it('collapses Wikidata URL variants to the Q-id', () => {
    expect(
      normalizeAuthorityValue('Wikidata', 'http://www.wikidata.org/entity/Q468747'),
    ).toBe('Q468747');
    expect(
      normalizeAuthorityValue('Wikidata', 'https://www.wikidata.org/wiki/Q468747'),
    ).toBe('Q468747');
    expect(normalizeAuthorityValue('Wikidata', 'Q468747')).toBe('Q468747');
  });

  it('collapses VIAF URLs to the numeric id', () => {
    expect(normalizeAuthorityValue('VIAF', 'http://viaf.org/viaf/28528075')).toBe('28528075');
    expect(normalizeAuthorityValue('VIAF', '28528075')).toBe('28528075');
  });

  it('trims everything else', () => {
    expect(normalizeAuthorityValue('CBDB', ' 25788 ')).toBe('25788');
  });
});

describe('findAuthorityDuplicates', () => {
  it('groups entities sharing a normalized authority id', () => {
    const doc = makeDoc();
    const a = addEntity(doc, 'person', {
      name: 'A',
      authorityIds: [{ type: 'Wikidata', value: 'http://www.wikidata.org/entity/Q468747' }],
    }).id;
    const b = addEntity(doc, 'person', {
      name: 'B',
      authorityIds: [{ type: 'Wikidata', value: 'https://www.wikidata.org/wiki/Q468747' }],
    }).id;
    addEntity(doc, 'person', {
      name: 'C',
      authorityIds: [{ type: 'Wikidata', value: 'Q999' }],
    });

    const groups = findAuthorityDuplicates(doc);
    expect(groups).toEqual([{ type: 'Wikidata', value: 'Q468747', entityIds: [a, b] }]);
  });

  it('does not flag the same idno repeated on a single entity', () => {
    const doc = makeDoc();
    addEntity(doc, 'person', {
      name: 'A',
      authorityIds: [
        { type: 'Wikidata', value: 'http://www.wikidata.org/entity/Q468747' },
        { type: 'Wikidata', value: 'https://www.wikidata.org/wiki/Q468747' },
      ],
    });
    expect(findAuthorityDuplicates(doc)).toEqual([]);
  });

  it('suppresses groups marked intentional, but re-triggers when a new member joins', () => {
    const doc = makeDoc();
    const shared = { type: 'CBDB', value: '25788' };
    const a = addEntity(doc, 'person', { name: 'A', authorityIds: [shared] }).id;
    const b = addEntity(doc, 'person', { name: 'B', authorityIds: [shared] }).id;

    markDuplicateIntentional(doc, [a, b]);
    expect(findAuthorityDuplicates(doc)).toEqual([]);

    const c = addEntity(doc, 'person', { name: 'C', authorityIds: [shared] }).id;
    const groups = findAuthorityDuplicates(doc);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.entityIds).toEqual([a, b, c]);
  });

  it('is idempotent when marking the same group twice', () => {
    const doc = makeDoc();
    const shared = { type: 'CBDB', value: '1' };
    const a = addEntity(doc, 'person', { name: 'A', authorityIds: [shared] }).id;
    const b = addEntity(doc, 'person', { name: 'B', authorityIds: [shared] }).id;

    markDuplicateIntentional(doc, [a, b]);
    markDuplicateIntentional(doc, [a, b]);
    const notes = Array.from(doc.getElementsByTagName('note')).filter(
      (note) => note.getAttribute('type') === 'duplicate-ok',
    );
    expect(notes).toHaveLength(1);
  });
});
