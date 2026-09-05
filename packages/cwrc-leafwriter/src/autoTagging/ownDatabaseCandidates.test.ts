import { addEntity, createEntitiesScaffold, parseEntities } from './entities';
import { setNameType, setUserWorkDate } from './entityOps';
import {
  candidatesFromEntityDatabase,
  candidatesFromEntityDatabaseRecords,
} from './ownDatabaseCandidates';
import { resolveNameTypeTaggingPolicy } from './nameTypeTaggingPolicy';

describe('candidatesFromEntityDatabase', () => {
  it('generates the same candidate shape directly from SQLite records', () => {
    const [candidate] = candidatesFromEntityDatabaseRecords(
      [
        {
          id: 'person-sqlite-1',
          kind: 'person',
          names: [
            { text: '王安石', type: 'primary' },
            { text: '介甫', type: 'courtesy' },
          ],
          description: 'Song dynasty statesman',
          startYear: 1021,
          endYear: 1086,
          nobleTitles: [{ fief: '荊國', roleName: '公', dynasty: '宋' }],
        },
      ],
      'PEDB',
    );
    expect(candidate).toMatchObject({
      authorityId: 'person-sqlite-1',
      primaryName: '王安石',
      source: 'PEDB',
      metadata: { description: 'Song dynasty statesman', startYear: 1021, endYear: 1086 },
    });
    expect(candidate!.searchStrings).toEqual(expect.arrayContaining(['王安石', '宋荊國公王安石']));
  });

  it('threads a thing sub-type into candidate.metadata.subtype', () => {
    const [candidate] = candidatesFromEntityDatabaseRecords(
      [
        {
          id: 'thing-qi',
          kind: 'thing',
          names: [{ text: '氣' }],
          subtype: 'philosophical_concept',
          nobleTitles: [],
        },
      ],
      'PEDB',
    );
    expect(candidate).toMatchObject({
      authorityId: 'thing-qi',
      kind: 'thing',
      metadata: { subtype: 'philosophical_concept' },
    });
  });

  it('omits metadata entirely for a thing with no subtype and no other metadata', () => {
    const [candidate] = candidatesFromEntityDatabaseRecords(
      [{ id: 'thing-qi-2', kind: 'thing', names: [{ text: '氣' }], nobleTitles: [] }],
      'PEDB',
    );
    expect(candidate?.metadata).toBeUndefined();
  });

  it('recovers search strings, dates, and description for a person', () => {
    const doc = parseEntities(createEntitiesScaffold());
    addEntity(doc, 'person', {
      name: '王安石',
      altNames: [{ text: 'Wang Anshi' }],
      description: 'Song dynasty statesman',
      startYear: 1021,
      endYear: 1086,
    });

    const [candidate] = candidatesFromEntityDatabase(doc, 'person', 'PEDB');
    expect(candidate).toBeDefined();
    expect(candidate!.source).toBe('PEDB');
    expect(candidate!.kind).toBe('person');
    expect(candidate!.primaryName).toBe('王安石');
    expect(candidate!.searchStrings).toEqual(expect.arrayContaining(['王安石', 'Wang Anshi']));
    expect(candidate!.metadata?.description).toBe('Song dynasty statesman');
    expect(candidate!.metadata?.startYear).toBe(1021);
    expect(candidate!.metadata?.endYear).toBe(1086);
  });

  it('recovers dates from the note[type=dates] fallback for a place', () => {
    const doc = parseEntities(createEntitiesScaffold());
    addEntity(doc, 'place', {
      name: '建康',
      description: 'Capital of several southern dynasties',
      startYear: 229,
      endYear: 589,
    });

    const [candidate] = candidatesFromEntityDatabase(doc, 'place', 'CEDB');
    expect(candidate).toBeDefined();
    expect(candidate!.source).toBe('CEDB');
    expect(candidate!.kind).toBe('place');
    expect(candidate!.primaryName).toBe('建康');
    expect(candidate!.metadata?.description).toBe('Capital of several southern dynasties');
    expect(candidate!.metadata?.startYear).toBe(229);
    expect(candidate!.metadata?.endYear).toBe(589);
  });

  it('recovers structured work dates from note attributes', () => {
    const doc = parseEntities(createEntitiesScaffold());
    const { id } = addEntity(doc, 'work', { name: '南齊書' });
    setUserWorkDate(doc, id, 459, 498, 'not before', 'ca.');

    const [candidate] = candidatesFromEntityDatabase(doc, 'work', 'PEDB');
    expect(candidate).toBeDefined();
    expect(candidate!.metadata?.startYear).toBe(459);
    expect(candidate!.metadata?.endYear).toBe(498);
  });

  it('returns no candidates for an empty kind list', () => {
    const doc = parseEntities(createEntitiesScaffold());
    expect(candidatesFromEntityDatabase(doc, 'org', 'PEDB')).toEqual([]);
  });

  it('skips entities without any name text', () => {
    const doc = parseEntities(createEntitiesScaffold());
    const { element } = addEntity(doc, 'work', { name: 'placeholder' });
    element.getElementsByTagName('title')[0]!.textContent = '   ';

    expect(candidatesFromEntityDatabase(doc, 'work', 'PEDB')).toEqual([]);
  });

  it('expands a confirmed nobleTitle into matchable strings, without a bare posthumous-name entry', () => {
    const doc = parseEntities(createEntitiesScaffold());
    addEntity(doc, 'person', {
      name: '曹操',
      nobleTitles: [
        {
          dynasty: '魏',
          placeName: { text: '魏' },
          roleName: { text: '帝' },
          posthumousName: { text: '武' },
        },
      ],
    });

    const [candidate] = candidatesFromEntityDatabase(doc, 'person', 'PEDB');
    expect(candidate!.searchStrings).toEqual(
      expect.arrayContaining(['曹操', '魏武帝', '魏武帝曹操']),
    );
    // The posthumous name alone ("武") must never appear as its own bare
    // search string — it's a title component, not a name of the person.
    expect(candidate!.searchStrings).not.toContain('武');
  });

  it('expands a confirmed consort/dowager nobleTitle using a typed family name', () => {
    const doc = parseEntities(createEntitiesScaffold());
    addEntity(doc, 'person', {
      name: '常氏',
      altNames: [{ text: '常', type: 'family' }],
      nobleTitles: [{ placeName: { text: '' }, roleName: { text: '太后' } }],
    });

    const [candidate] = candidatesFromEntityDatabase(doc, 'person', 'PEDB');
    expect(candidate!.searchStrings).toContain('皇太后常氏');
  });

  it('adds the 皇太子 form for a confirmed 太子 nobleTitle', () => {
    const doc = parseEntities(createEntitiesScaffold());
    addEntity(doc, 'person', {
      name: '楊勇',
      nobleTitles: [{ placeName: { text: '' }, roleName: { text: '太子' } }],
    });

    const [candidate] = candidatesFromEntityDatabase(doc, 'person', 'PEDB');
    expect(candidate!.searchStrings).toEqual(expect.arrayContaining(['太子楊勇', '皇太子楊勇']));
  });

  it('threads a typed family name through candidatesFromEntityDatabaseRecords too', () => {
    const [candidate] = candidatesFromEntityDatabaseRecords(
      [
        {
          id: 'person-sqlite-2',
          kind: 'person',
          names: [
            { text: '常氏', type: 'primary' },
            { text: '常', type: 'family' },
          ],
          nobleTitles: [{ roleName: '太后' }],
        },
      ],
      'PEDB',
    );
    expect(candidate!.searchStrings).toContain('皇太后常氏');
  });

  it('filters courtesy names from phase1 searchStrings using name types on persName', () => {
    const doc = parseEntities(createEntitiesScaffold());
    const { id } = addEntity(doc, 'person', {
      name: '王安石',
      altNames: [{ text: '王介甫', type: 'courtesy' }],
    });
    setNameType(doc, id, '王安石', 'primary');

    const zhPolicy = resolveNameTypeTaggingPolicy(undefined, 'zh');
    const [candidate] = candidatesFromEntityDatabase(doc, 'person', 'PEDB', zhPolicy);
    expect(candidate!.searchStrings).toEqual(['王安石']);
    expect(candidate!.names).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: '王介甫', type: 'courtesy' })]),
    );
  });
});
