import {
  addEntity,
  createEntitiesScaffold,
  findEntity,
  getDatabaseId,
  isEntityDatabase,
  LJB_AUTOTAG_RESP,
  nextEntityId,
  parseEntities,
  serializeEntities,
  TAG_TO_KIND,
} from './entities';

describe('entities scaffold', () => {
  it('creates an empty TEI standoff with the four core lists', () => {
    const doc = parseEntities(createEntitiesScaffold('test-db-id'));
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    for (const list of ['listPerson', 'listPlace', 'listOrg', 'listBibl']) {
      expect(doc.getElementsByTagName(list)).toHaveLength(1);
    }
    expect(getDatabaseId(doc)).toBe('test-db-id');
    expect(isEntityDatabase(doc)).toBe(true);
  });
});

describe('nextEntityId', () => {
  it('starts at 000001 per type and is typed', () => {
    const doc = parseEntities(createEntitiesScaffold());
    expect(nextEntityId(doc, 'person')).toBe('person-000001');
    expect(nextEntityId(doc, 'place')).toBe('place-000001');
  });

  it('takes the highest existing suffix + 1, independent of insertion order', () => {
    const doc = parseEntities(createEntitiesScaffold());
    addEntity(doc, 'person', { name: 'A' }); // person-000001
    addEntity(doc, 'person', { name: 'B' }); // person-000002
    expect(nextEntityId(doc, 'person')).toBe('person-000003');
    // places are numbered independently
    expect(nextEntityId(doc, 'place')).toBe('place-000001');
  });

  it('skips ids that already exist (collision-safe)', () => {
    const doc = parseEntities(createEntitiesScaffold());
    // pre-seed a gap: person-000005 present, lower ones absent
    const { element } = addEntity(doc, 'person', { name: 'X' });
    element.setAttribute('xml:id', 'person-000005');
    expect(nextEntityId(doc, 'person')).toBe('person-000006');
  });
});

describe('addEntity', () => {
  it('writes a typed entity with name, authority idnos, and provenance', () => {
    const doc = parseEntities(createEntitiesScaffold());
    const { id } = addEntity(
      doc,
      'person',
      {
        name: '張衡',
        authorityIds: [
          { type: 'CBDB', value: '1762' },
          { type: 'Wikidata', value: 'Q11332' },
        ],
      },
      LJB_AUTOTAG_RESP,
    );

    expect(id).toBe('person-000001');
    const el = findEntity(doc, id)!;
    expect(el.nodeName).toBe('person');
    expect(el.getAttribute('resp')).toBe(LJB_AUTOTAG_RESP);
    expect(el.getElementsByTagName('persName')[0]?.textContent).toBe('張衡');

    const idnos = Array.from(el.getElementsByTagName('idno'));
    expect(idnos.map((i) => `${i.getAttribute('type')}:${i.textContent}`)).toEqual([
      'CBDB:1762',
      'Wikidata:Q11332',
    ]);

    // lands in the right list
    expect(doc.getElementsByTagName('listPerson')[0]?.getElementsByTagName('person')).toHaveLength(1);
  });

  it('stores an authority cache note as JSON', () => {
    const doc = parseEntities(createEntitiesScaffold());
    const { id } = addEntity(doc, 'place', {
      name: '洛陽',
      cache: { source: 'CHGIS', data: { lat: 34.6, lng: 112.4 }, when: '2026-07-03T00:00:00Z' },
    });
    const note = findEntity(doc, id)!.getElementsByTagName('note')[0]!;
    expect(note.getAttribute('type')).toBe('authority-cache');
    expect(note.getAttribute('source')).toBe('CHGIS');
    expect(JSON.parse(note.textContent!)).toEqual({ lat: 34.6, lng: 112.4 });
  });

  it('round-trips through serialization', () => {
    const doc = parseEntities(createEntitiesScaffold());
    addEntity(doc, 'org', { name: '道藏' });
    const reparsed = parseEntities(serializeEntities(doc));
    expect(nextEntityId(reparsed, 'org')).toBe('org-000002');
    expect(reparsed.getElementsByTagName('org')).toHaveLength(1);
  });
});

describe('TAG_TO_KIND', () => {
  it('maps mention tags to entity kinds', () => {
    expect(TAG_TO_KIND.persName).toBe('person');
    expect(TAG_TO_KIND.placeName).toBe('place');
    expect(TAG_TO_KIND.orgName).toBe('org');
    expect(TAG_TO_KIND.title).toBe('work');
  });
});
