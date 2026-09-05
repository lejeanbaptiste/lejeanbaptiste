import {
  addEntity,
  appendAuthoritySourcedValues,
  createEntitiesScaffold,
  findEntity,
  parseEntities,
} from './entities';
import { getCentralId, setCentralMapping } from './concordance';
import {
  acceptEntityDescriptionAssertion,
  addEntityName,
  addUserNationality,
  addUserOrigin,
  applyConcordanceAssociations,
  attachAuthority,
  deleteEntity,
  detachAuthority,
  findAuthorityDuplicates,
  groupFieldAssertions,
  listEntities,
  markDuplicateIntentional,
  mergeEntities,
  normalizeAuthorityValue,
  removeEntityName,
  removeEntityValue,
  renameEntityName,
  setEntityDescription,
  setFamilyName,
  setGivenName,
  setNameType,
  setRomanizedName,
  taggableEntityNames,
  decoupleAuthority,
  listEntityAssertions,
  listConcordanceRejections,
  rejectConcordance,
  rejectEntityAssertion,
  setUserWorkDate,
  validateEntityAssertion,
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

  it('excludes the per-user grognard-central concordance row from authorities', () => {
    const doc = makeDoc();
    const { element } = addEntity(doc, 'person', {
      name: '王導',
      authorityIds: [{ type: 'CBDB', value: '25788' }],
    });
    setCentralMapping(element, 'user-a', 'person-central-1');

    expect(listEntities(doc)[0]!.authorities).toEqual([{ type: 'CBDB', value: '25788' }]);
  });
});

describe('CBDB concordance updates', () => {
  const association = {
    source: 'CBDB',
    canonicalId: '141',
    mergedFromId: '96120',
    notes: 'same person',
  };

  it('adds a new authority id to the one matching local entity', () => {
    const doc = makeDoc();
    const entity = addEntity(doc, 'person', {
      name: '喬維岳',
      authorityIds: [{ type: 'CBDB', value: '141' }],
    });
    const result = applyConcordanceAssociations(doc, [association]);
    expect(result).toMatchObject({ applied: 1, conflicts: [] });
    expect(listEntities(doc).find((item) => item.id === entity.id)?.authorities).toEqual([
      { type: 'CBDB', value: '141' },
      { type: 'CBDB', value: '96120' },
    ]);
  });

  it('preserves a user rejection across repeated authority updates', () => {
    const doc = makeDoc();
    const entity = addEntity(doc, 'person', {
      name: '喬維岳',
      authorityIds: [{ type: 'CBDB', value: '141' }],
    });
    rejectConcordance(doc, association, entity.id);
    expect(applyConcordanceAssociations(doc, [association])).toMatchObject({
      rejected: 1,
      applied: 0,
    });
    expect(listConcordanceRejections(doc)).toHaveLength(1);
    expect(
      listEntities(doc).find((item) => item.id === entity.id)?.rejectedConcordances,
    ).toHaveLength(1);
  });

  it('does not merge two distinct local entities automatically', () => {
    const doc = makeDoc();
    addEntity(doc, 'person', { name: '喬維岳', authorityIds: [{ type: 'CBDB', value: '141' }] });
    addEntity(doc, 'person', { name: '喬維岳', authorityIds: [{ type: 'CBDB', value: '96120' }] });
    const result = applyConcordanceAssociations(doc, [association]);
    expect(result.conflicts).toHaveLength(1);
    expect(listEntities(doc).flatMap((item) => item.authorities)).toHaveLength(2);
  });
});

describe('field-level provenance', () => {
  it('validates and rejects imported assertions without losing their source', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', {
      name: '張衡',
      nationality: [{ id: 'han', canonicalId: 'han', label: '漢', sourceIds: ['CBDB:1'] }],
      nobleTitles: [
        {
          source: 'xml:chapter-1#wrapper-2',
          origin: 'xml',
          placeName: { text: '鄱陽' },
          roleName: { text: '王' },
        },
      ],
    });
    const assertions = listEntityAssertions(doc, id);
    const authority = assertions.find((a) => a.value === '漢')!;
    const extracted = assertions.find((a) => a.value.includes('鄱陽'))!;
    expect(authority.origin).toBe('authority');
    expect(extracted.origin).toBe('xml');
    expect(validateEntityAssertion(doc, id, authority.key)).toBe(true);
    expect(listEntityAssertions(doc, id).find((a) => a.key === authority.key)).toMatchObject({
      origin: 'user',
      source: 'CBDB:1',
      status: 'active',
    });
    expect(rejectEntityAssertion(doc, id, extracted.key)).toBe(true);
    expect(listEntityAssertions(doc, id).find((a) => a.key === extracted.key)).toMatchObject({
      origin: 'xml',
      source: 'xml:chapter-1#wrapper-2',
      status: 'rejected',
    });
  });

  it('decouples active authority data but preserves rejected tombstones', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', {
      name: '張衡',
      nationality: [{ id: 'han', canonicalId: 'han', label: '漢', sourceIds: ['CBDB:1'] }],
    });
    const assertion = listEntityAssertions(doc, id).find((a) => a.value === '漢')!;
    rejectEntityAssertion(doc, id, assertion.key);
    expect(decoupleAuthority(doc, id, { type: 'CBDB', value: '1' })).toBe(0);
    expect(listEntityAssertions(doc, id).find((a) => a.key === assertion.key)?.status).toBe(
      'rejected',
    );
  });
});

describe('groupFieldAssertions', () => {
  it('groups a multi-valued field into agreeing/pending/rejected', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '劉善明' });
    const el = findEntity(doc, id)!;
    appendAuthoritySourcedValues(doc, el, 'nationality', [
      { text: '宋(劉)', ref: 'dynasty:song-liu', source: 'CBDB' },
      { text: '宋(劉)', ref: 'dynasty:song-liu', source: 'DILA' },
      { text: '南齊', ref: 'dynasty:qi', source: 'Wikidata' },
    ]);
    const assertions = listEntityAssertions(doc, id).filter((a) => a.element === 'nationality');
    const groups = groupFieldAssertions(assertions, new Set(['宋(劉)']), false);
    expect(groups.agreeingSources.sort()).toEqual(['CBDB', 'DILA']);
    expect(groups.pending).toHaveLength(1);
    expect(groups.pending[0]?.value).toBe('南齊');
    expect(groups.rejected).toHaveLength(0);
  });

  it('only includes rejected assertions when showRejected is true', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '劉善明' });
    const el = findEntity(doc, id)!;
    appendAuthoritySourcedValues(doc, el, 'nationality', [
      { text: '南齊', ref: 'dynasty:qi', source: 'Wikidata' },
    ]);
    const key = listEntityAssertions(doc, id).find((a) => a.element === 'nationality')!.key;
    rejectEntityAssertion(doc, id, key);

    const assertions = listEntityAssertions(doc, id).filter((a) => a.element === 'nationality');
    expect(groupFieldAssertions(assertions, new Set(), false).rejected).toHaveLength(0);
    expect(groupFieldAssertions(assertions, new Set(), true).rejected).toHaveLength(1);
  });
});

describe('EntitySummary nationalities/placesOfOrigin', () => {
  it('excludes rejected elements and dedupes identical labels from multiple sources', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '劉善明' });
    const el = findEntity(doc, id)!;
    // CBDB and DILA dynasty ids for 劉宋 (Liu Song), per the curated crosswalk.
    appendAuthoritySourcedValues(doc, el, 'nationality', [
      { text: '劉宋', ref: '28', source: 'CBDB' },
      { text: '宋(劉)', ref: '57', source: 'DILA' },
      { text: '南齊', ref: 'https://www.wikidata.org/entity/Q62456', source: 'Wikidata' },
    ]);
    const rejectedKey = listEntityAssertions(doc, id).find(
      (a) => a.element === 'nationality' && a.value === '南齊',
    )!.key;
    rejectEntityAssertion(doc, id, rejectedKey);

    const summary = listEntities(doc).find((entity) => entity.id === id)!;
    expect(summary.nationalities).toEqual(['劉宋']);
  });

  it('merges dynasty aliases from different authorities via the curated id crosswalk', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '曹丕' });
    const el = findEntity(doc, id)!;
    // CBDB dynasty id 26 and DILA dynasty id 35 both crosswalk to 三國魏 (Cao Wei).
    appendAuthoritySourcedValues(doc, el, 'nationality', [
      { text: '三國魏', ref: '26', source: 'CBDB' },
      { text: '曹魏', ref: '35', source: 'DILA' },
    ]);

    const summary = listEntities(doc).find((entity) => entity.id === id)!;
    expect(summary.nationalities).toEqual(['三國魏']);
  });
});

describe('work dates', () => {
  it('saves and summarizes structured work date precision', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'work', { name: '南齊書' });
    setUserWorkDate(doc, id, 459, 498, 'not before', 'ca.');

    const summary = listEntities(doc).find((entity) => entity.id === id)!;
    expect(summary.workDate).toEqual({
      startYear: 459,
      endYear: 498,
      startPrecision: 'not before',
      endPrecision: 'ca.',
    });

    const note = Array.from(findEntity(doc, id)!.getElementsByTagName('note')).find(
      (el) => el.getAttribute('type') === 'dates',
    )!;
    expect(note.getAttribute('type')).toBe('dates');
    expect(note.getAttribute('from')).toBe('0459');
    expect(note.getAttribute('to')).toBe('0498');
    expect(note.getAttribute('fromPrecision')).toBe('not before');
    expect(note.getAttribute('toPrecision')).toBe('ca.');
  });
});

describe('acceptEntityDescriptionAssertion', () => {
  it('promotes an authority description to user, removing any prior user description', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '劉善明' });
    setEntityDescription(doc, id, 'My own note');
    const el = findEntity(doc, id)!;
    appendAuthoritySourcedValues(doc, el, 'note', [
      { text: 'A Song dynasty official.', noteType: 'description', source: 'Wikidata' },
      { text: 'Served under Emperor Ming.', noteType: 'description', source: 'CBDB' },
    ]);

    const target = listEntityAssertions(doc, id).find(
      (a) => a.element === 'note' && a.value === 'A Song dynasty official.',
    )!;
    expect(acceptEntityDescriptionAssertion(doc, id, target.key)).toBe(true);

    const summary = listEntities(doc).find((entity) => entity.id === id)!;
    expect(summary.description).toBe('A Song dynasty official.');

    // the other authority description is untouched and still pending
    const remaining = listEntityAssertions(doc, id).filter(
      (a) => a.element === 'note' && a.noteType === 'description',
    );
    expect(remaining).toHaveLength(2);
    expect(remaining.find((a) => a.value === 'Served under Emperor Ming.')?.origin).toBe(
      'authority',
    );
  });
});

describe('addUserNationality / addUserOrigin / removeEntityValue', () => {
  it('adds a user-origin nationality and dedupes a repeat add', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '劉善明' });
    expect(addUserNationality(doc, id, '南齊')).toBe(true);
    expect(addUserNationality(doc, id, '南齊')).toBe(false);

    const summary = listEntities(doc).find((entity) => entity.id === id)!;
    expect(summary.nationalities).toEqual(['南齊']);
    const assertion = listEntityAssertions(doc, id).find((a) => a.element === 'nationality')!;
    expect(assertion.origin).toBe('user');
  });

  it('preserves the authority reference when a lookup-backed nationality is selected', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '劉備' });
    expect(
      addUserNationality(doc, id, 'Liu Song dynasty', {
        ref: 'https://www.wikidata.org/wiki/Q49697',
        source: 'Wikidata',
      }),
    ).toBe(true);

    const assertion = listEntityAssertions(doc, id).find((a) => a.element === 'nationality')!;
    expect(assertion.ref).toBe('https://www.wikidata.org/wiki/Q49697');
    expect(assertion.source).toBe('Wikidata');
  });

  it('adds a user-origin place of origin', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '劉善明' });
    expect(addUserOrigin(doc, id, '洛陽')).toBe(true);
    const summary = listEntities(doc).find((entity) => entity.id === id)!;
    expect(summary.placesOfOrigin).toEqual(['洛陽']);
  });

  it('hard-deletes a user value but rejects (tombstones) an authority value', () => {
    const doc = makeDoc();
    const { id } = addEntity(doc, 'person', { name: '劉善明' });
    addUserNationality(doc, id, '洛陽州');
    const el = findEntity(doc, id)!;
    appendAuthoritySourcedValues(doc, el, 'nationality', [
      { text: '南齊', ref: 'dynasty:qi', source: 'Wikidata' },
    ]);

    const userAssertion = listEntityAssertions(doc, id).find((a) => a.value === '洛陽州')!;
    const authorityAssertion = listEntityAssertions(doc, id).find((a) => a.value === '南齊')!;

    expect(removeEntityValue(doc, id, userAssertion.key)).toBe(true);
    expect(removeEntityValue(doc, id, authorityAssertion.key)).toBe(true);

    const remaining = listEntityAssertions(doc, id).filter((a) => a.element === 'nationality');
    expect(remaining.find((a) => a.value === '洛陽州')).toBeUndefined(); // hard-deleted
    const rejected = remaining.find((a) => a.value === '南齊')!;
    expect(rejected.status).toBe('rejected'); // tombstoned, not deleted
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
      nameEntries: expect.arrayContaining([
        expect.objectContaining({ text: '江', type: 'family' }),
      ]),
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
    expect(listEntities(doc)[0]!.authorities).toEqual([{ type: 'Wikidata', value: 'Q967998' }]);

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
      { type: 'Wikidata', value: 'Q3274914' },
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

  it('returns no central conflicts when neither side has a grognard-central mapping', () => {
    const doc = makeDoc();
    const keep = addEntity(doc, 'person', { name: 'A' }).id;
    const drop = addEntity(doc, 'person', { name: 'B' }).id;
    const { centralConflicts } = mergeEntities(doc, keep, [drop]);
    expect(centralConflicts).toEqual([]);
  });

  it('transfers a grognard-central mapping the keeper lacks from the dropped entity', () => {
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
      {
        userStableId: 'user-a',
        keptCentralId: 'person-central-1',
        droppedCentralId: 'person-central-2',
      },
    ]);
    const keeper = findEntity(doc, keepEl.id)!;
    expect(getCentralId(keeper, 'user-a')).toBe('person-central-1');
  });

  it('does not duplicate a grognard-central mapping when both sides already agree', () => {
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
      {
        userStableId: 'user-a',
        keptCentralId: 'person-central-1',
        droppedCentralId: 'person-central-2',
      },
    ]);
    const keeper = findEntity(doc, keepEl.id)!;
    expect(getCentralId(keeper, 'user-a')).toBe('person-central-1');
    expect(getCentralId(keeper, 'user-b')).toBe('person-central-9');
  });

  it('never copies the grognard-central row as a generic authority idno', () => {
    const doc = makeDoc();
    const keepEl = addEntity(doc, 'person', { name: 'A' });
    const dropEl = addEntity(doc, 'person', { name: 'B' });
    setCentralMapping(dropEl.element, 'user-a', 'person-central-1');

    mergeEntities(doc, keepEl.id, [dropEl.id]);
    // authorities() already excludes grognard-central (see the listEntities test below);
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
    expect(normalizeAuthorityValue('Wikidata', 'http://www.wikidata.org/entity/Q468747')).toBe(
      'Q468747',
    );
    expect(normalizeAuthorityValue('Wikidata', 'https://www.wikidata.org/wiki/Q468747')).toBe(
      'Q468747',
    );
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
