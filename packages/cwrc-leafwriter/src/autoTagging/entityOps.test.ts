import { addEntity, createEntitiesScaffold, parseEntities } from './entities';
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
  setEntityDescription,
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

  it('keeps the keeper description when both have one', () => {
    const doc = makeDoc();
    const keep = addEntity(doc, 'person', { name: 'A', description: 'keeper' }).id;
    const drop = addEntity(doc, 'person', { name: 'B', description: 'dropped' }).id;

    mergeEntities(doc, keep, [drop]);
    expect(listEntities(doc)[0]!.description).toBe('keeper');
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
