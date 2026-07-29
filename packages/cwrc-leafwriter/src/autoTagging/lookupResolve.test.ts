import { addEntity, findEntity } from './entities';
import { EntityStore, type EntityFileApi } from './entityStore';
import { resolveEntityStorePaths } from './entityStoreResolve';
import {
  applyLookupResolution,
  appendExtraAuthorityIds,
  crosswalkForRef,
  linkLocalEntityWithoutAuthority,
  linkWithoutEnrichment,
  parseAuthorityUri,
  planLookupResolution,
  type LookupSelectionInput,
} from './lookupResolve';
import { listEntityAssertions } from './entityOps';
import type { AuthorityPackId } from './packPaths';

class FakeFs implements EntityFileApi {
  files = new Map<string, string>();
  dirs = new Set<string>();
  ensureDirectory = async (dir: string) => {
    this.dirs.add(dir);
  };
  pathExists = async (path: string) => this.files.has(path);
  readFile = async (path: string) => {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`no such file: ${path}`);
    return content;
  };
  writeFile = async (path: string, content: string) => {
    this.files.set(path, content);
  };
}

const makeStore = () => {
  const fs = new FakeFs();
  const store = new EntityStore(fs, resolveEntityStorePaths({ projectRoot: '/proj' }));
  return { fs, store };
};

const input = (over: Partial<LookupSelectionInput> = {}): LookupSelectionInput => ({
  uri: 'https://www.wikidata.org/wiki/Q712570',
  label: '沈攸之',
  entityType: 'person',
  query: '攸之',
  ...over,
});

const ndjsonLine = (row: object) => JSON.stringify(row);

const packRow = ndjsonLine({
  source: 'cbdb',
  authorityId: '31305',
  kind: 'person',
  primaryName: '沈攸之',
  searchStrings: ['沈攸之', '攸之'],
  metadata: {
    description: 'Liu-Song general, d. 478',
    startYear: 420,
    endYear: 478,
    crosswalk: { wikidata: ['Q712570'], dila: 'A001492' },
  },
});

const readPackFile = async (_packId: AuthorityPackId) => packRow + '\n';
const packIds: AuthorityPackId[] = ['cbdb-persons'];

const dilaPackRow = ndjsonLine({
  source: 'DILA',
  authorityId: 'A003126',
  kind: 'person',
  primaryName: '徐孝嗣',
  searchStrings: ['徐孝嗣', '徐始昌'],
  metadata: {
    description: '徐孝嗣 (453–499, 南齊, 徐湛之孫，徐聿之子)',
    startYear: 453,
    endYear: 499,
    crosswalk: { wikidata: ['Q11070461'], cbdb: '193924' },
  },
});

const readDilaPackFile = async (_packId: AuthorityPackId) => dilaPackRow + '\n';
const dilaPackIds: AuthorityPackId[] = ['dila-persons'];

describe('parseAuthorityUri', () => {
  it('parses known authority URIs', () => {
    expect(parseAuthorityUri('https://www.wikidata.org/wiki/Q712570')).toEqual({
      idnoType: 'Wikidata',
      crosswalkKey: 'wikidata',
      value: 'Q712570',
    });
    expect(parseAuthorityUri('http://www.wikidata.org/entity/q712570')?.value).toBe('Q712570');
    expect(parseAuthorityUri('https://viaf.org/viaf/12345/')).toMatchObject({
      idnoType: 'VIAF',
      value: '12345',
    });
    expect(parseAuthorityUri('https://cbdb.fas.harvard.edu/cbdbapi/person.php?id=31305')).toMatchObject({
      idnoType: 'CBDB',
      value: '31305',
    });
    // legacy CBDB link format, still parseable
    expect(parseAuthorityUri('https://cbdb.fas.harvard.edu/person?id=31305')).toMatchObject({
      idnoType: 'CBDB',
      value: '31305',
    });
    expect(
      parseAuthorityUri('https://authority.dila.edu.tw/person/?fromInner=A001492'),
    ).toMatchObject({ idnoType: 'DILA', value: 'A001492' });
    expect(
      parseAuthorityUri('https://authority.dila.edu.tw/place/?fromInner=PL000000030584'),
    ).toMatchObject({ idnoType: 'DILA', value: 'PL000000030584' });
    // legacy link formats, still parseable
    expect(
      parseAuthorityUri('https://authority.dila.edu.tw/person/search.php?code=A001492'),
    ).toMatchObject({ idnoType: 'DILA', value: 'A001492' });
    expect(
      parseAuthorityUri('https://authority.dila.edu.tw/person/search.php?aid=A001492'),
    ).toMatchObject({ idnoType: 'DILA', value: 'A001492' });
    expect(parseAuthorityUri('https://id.ndl.go.jp/auth/ndlna/00270123')).toMatchObject({
      idnoType: 'NDL',
      value: '00270123',
    });
  });

  it('returns null for unknown URIs', () => {
    expect(parseAuthorityUri('https://example.org/people/42')).toBeNull();
  });
});

describe('crosswalkForRef', () => {
  it('expands a wikidata ref through the pack crosswalk', async () => {
    const result = await crosswalkForRef(
      { idnoType: 'Wikidata', crosswalkKey: 'wikidata', value: 'Q712570' },
      packIds,
      readPackFile,
    );
    expect(result.idnos).toEqual(
      expect.arrayContaining([
        { type: 'Wikidata', value: 'Q712570' },
        { type: 'CBDB', value: '31305' },
        { type: 'DILA', value: 'A001492' },
      ]),
    );
    expect(result.candidate?.primaryName).toBe('沈攸之');
  });

  it('matches a ref by the pack row own id', async () => {
    const result = await crosswalkForRef(
      { idnoType: 'CBDB', crosswalkKey: 'cbdb', value: '31305' },
      packIds,
      readPackFile,
    );
    expect(result.idnos).toEqual(
      expect.arrayContaining([{ type: 'Wikidata', value: 'Q712570' }]),
    );
  });
});

describe('planLookupResolution / applyLookupResolution', () => {
  it('mints a new entity when nothing matches, carrying crosswalk idnos', async () => {
    const { store } = makeStore();
    const result = await applyLookupResolution(input(), { store, packIds, readPackFile });
    expect(result).toMatchObject({ status: 'linked', wasCreated: true });
    if (result.status !== 'linked') return;

    const doc = await store.loadEntities();
    const person = doc.getElementsByTagName('person')[0]!;
    expect(person.getAttribute('xml:id')).toBe(result.key);
    const idnoTypes = Array.from(person.getElementsByTagName('idno')).map((el) =>
      el.getAttribute('type'),
    );
    expect(idnoTypes).toEqual(expect.arrayContaining(['Wikidata', 'CBDB', 'DILA']));
    // Pack primary name preferred over the clicked label
    expect(person.getElementsByTagName('persName')[0]?.textContent).toBe('沈攸之');
    const assertions = listEntityAssertions(doc, result.key);
    expect(assertions.find((a) => a.element === 'birth')).toMatchObject({
      origin: 'authority',
      source: 'CBDB',
      status: 'active',
    });
    expect(assertions.find((a) => a.element === 'death')).toMatchObject({
      origin: 'authority',
      source: 'CBDB',
      status: 'active',
    });
  });

  it('links to an existing entity on a direct idno hit and enriches it', async () => {
    const { store } = makeStore();
    const doc = await store.loadEntities();
    const { id } = addEntity(doc, 'person', {
      name: '沈攸之',
      authorityIds: [{ type: 'Wikidata', value: 'Q712570' }],
    });
    await store.saveEntities(doc);

    const plan = await planLookupResolution(input(), { store, packIds, readPackFile });
    expect(plan).toMatchObject({ action: 'link', key: id, matchedBy: 'direct' });

    const result = await applyLookupResolution(input(), { store, packIds, readPackFile });
    expect(result).toMatchObject({ status: 'linked', key: id, wasCreated: false });

    const after = await store.loadEntities();
    const idnos = Array.from(after.getElementsByTagName('idno')).map((el) => [
      el.getAttribute('type'),
      el.textContent,
    ]);
    expect(idnos).toEqual(
      expect.arrayContaining([
        ['CBDB', '31305'],
        ['DILA', 'A001492'],
      ]),
    );
  });

  it('hydrates authority dates when linking an existing DILA entity', async () => {
    const { store } = makeStore();
    const doc = await store.loadEntities();
    const { id } = addEntity(doc, 'person', {
      name: '徐孝嗣',
      authorityIds: [{ type: 'DILA', value: 'A003126' }],
    });
    await store.saveEntities(doc);

    const result = await applyLookupResolution(
      input({
        uri: 'https://authority.dila.edu.tw/person/search.php?code=A003126',
        label: '徐孝嗣',
        query: '徐孝嗣',
      }),
      { store, packIds: dilaPackIds, readPackFile: readDilaPackFile },
    );
    expect(result).toMatchObject({ status: 'linked', key: id, wasCreated: false });

    const after = await store.loadEntities();
    const assertions = listEntityAssertions(after, id);
    expect(assertions.find((a) => a.element === 'birth')).toMatchObject({
      origin: 'authority',
      source: 'DILA',
      status: 'active',
    });
    expect(assertions.find((a) => a.element === 'death')).toMatchObject({
      origin: 'authority',
      source: 'DILA',
      status: 'active',
    });
  });

  it('mints per-source birth elements when two checked references each crosswalk independently', async () => {
    const { store } = makeStore();
    const combinedReadPackFile = async (packId: AuthorityPackId) =>
      packId === 'cbdb-persons' ? packRow + '\n' : dilaPackRow + '\n';

    const result = await applyLookupResolution(
      input({
        uri: 'https://cbdb.fas.harvard.edu/cbdbapi/person.php?id=31305',
        extraUris: ['https://authority.dila.edu.tw/person/?fromInner=A003126'],
      }),
      { store, packIds: ['cbdb-persons', 'dila-persons'], readPackFile: combinedReadPackFile },
    );
    expect(result).toMatchObject({ status: 'linked', wasCreated: true });
    if (result.status !== 'linked') return;

    const doc = await store.loadEntities();
    const assertions = listEntityAssertions(doc, result.key);
    const births = assertions.filter((a) => a.element === 'birth');
    expect(births).toHaveLength(2);
    expect(births.map((a) => a.source).sort()).toEqual(['CBDB', 'DILA']);
    expect(births.map((a) => a.value).sort()).toEqual(['0420', '0453']);
  });

  it('links via crosswalk when the entity only carries a CBDB idno', async () => {
    const { store } = makeStore();
    const doc = await store.loadEntities();
    const { id } = addEntity(doc, 'person', {
      name: '沈攸之',
      authorityIds: [{ type: 'CBDB', value: '31305' }],
    });
    await store.saveEntities(doc);

    const plan = await planLookupResolution(input(), { store, packIds, readPackFile });
    expect(plan).toMatchObject({ action: 'link', key: id, matchedBy: 'crosswalk' });
  });

  it('reports a conflict when two entities carry the same idno, without writing', async () => {
    const { store } = makeStore();
    const doc = await store.loadEntities();
    addEntity(doc, 'person', { name: 'A', authorityIds: [{ type: 'Wikidata', value: 'Q712570' }] });
    addEntity(doc, 'person', { name: 'B', authorityIds: [{ type: 'Wikidata', value: 'Q712570' }] });
    await store.saveEntities(doc);
    const before = await store.loadEntities().then((d) => d.getElementsByTagName('idno').length);

    const result = await applyLookupResolution(input(), { store, packIds, readPackFile });
    expect(result.status).toBe('conflict');
    if (result.status !== 'conflict') return;
    expect(result.candidates).toHaveLength(2);

    const after = await store.loadEntities().then((d) => d.getElementsByTagName('idno').length);
    expect(after).toBe(before);
  });

  it('reports a conflict when crosswalk ids land on two different entities', async () => {
    const { store } = makeStore();
    const doc = await store.loadEntities();
    addEntity(doc, 'person', { name: 'A', authorityIds: [{ type: 'CBDB', value: '31305' }] });
    addEntity(doc, 'person', { name: 'B', authorityIds: [{ type: 'DILA', value: 'A001492' }] });
    await store.saveEntities(doc);

    const plan = await planLookupResolution(input(), { store, packIds, readPackFile });
    expect(plan.action).toBe('conflict');
  });

  it('never overwrites a same-type idno with a different value; files a warning', async () => {
    const { fs, store } = makeStore();
    const doc = await store.loadEntities();
    const { id } = addEntity(doc, 'person', {
      name: '沈攸之',
      authorityIds: [
        { type: 'Wikidata', value: 'Q712570' },
        { type: 'CBDB', value: '99999' },
      ],
    });
    await store.saveEntities(doc);

    const result = await applyLookupResolution(input(), { store, packIds, readPackFile });
    expect(result).toMatchObject({ status: 'linked', key: id });

    const after = await store.loadEntities();
    const cbdbValues = Array.from(after.getElementsByTagName('idno'))
      .filter((el) => el.getAttribute('type') === 'CBDB')
      .map((el) => el.textContent);
    expect(cbdbValues).toEqual(['99999']);

    const warnings = fs.files.get('/proj/.ljb/entity-warnings.jsonl') ?? '';
    expect(warnings).toContain('idno-conflict');
    expect(warnings).toContain('31305');
  });

  it('dedupes a pasted plain URI instead of minting twice', async () => {
    const { store } = makeStore();
    const uri = 'https://example.org/people/42';
    const first = await applyLookupResolution(input({ uri, label: 'Someone' }), { store });
    const second = await applyLookupResolution(input({ uri, label: 'Someone' }), { store });
    expect(first).toMatchObject({ status: 'linked', wasCreated: true });
    if (first.status !== 'linked') return;
    expect(second).toMatchObject({ status: 'linked', wasCreated: false, key: first.key });
  });

  it('passes through entity types outside the database', async () => {
    const { store } = makeStore();
    const result = await applyLookupResolution(input({ entityType: 'concept' }), { store });
    expect(result.status).toBe('passthrough');
  });

  it('logs a manual-lookup decision', async () => {
    const { fs, store } = makeStore();
    await applyLookupResolution(input(), { store, packIds, readPackFile });
    const log = fs.files.get('/proj/.ljb/entity-decisions.jsonl') ?? '';
    expect(log).toContain('"source":"manual-lookup"');
    expect(log).toContain('"surface":"攸之"');
  });

  it('mints one entity carrying idnos from every checked candidate (extraUris)', async () => {
    const { store } = makeStore();
    const result = await applyLookupResolution(
      input({ extraUris: ['https://viaf.org/viaf/12345/'] }),
      { store, packIds, readPackFile },
    );
    expect(result).toMatchObject({ status: 'linked', wasCreated: true });
    if (result.status !== 'linked') return;

    const doc = await store.loadEntities();
    const person = doc.getElementsByTagName('person')[0]!;
    expect(person.getAttribute('xml:id')).toBe(result.key);
    const idnos = Array.from(person.getElementsByTagName('idno')).map((el) => [
      el.getAttribute('type'),
      el.textContent,
    ]);
    expect(idnos).toEqual(
      expect.arrayContaining([
        ['Wikidata', 'Q712570'],
        ['CBDB', '31305'],
        ['DILA', 'A001492'],
        ['VIAF', '12345'],
      ]),
    );
  });

  it('links an existing entity found via an extra checked candidate, enriching with both idno sets', async () => {
    const { store } = makeStore();
    const doc = await store.loadEntities();
    const { id } = addEntity(doc, 'person', {
      name: '沈攸之',
      authorityIds: [{ type: 'VIAF', value: '12345' }],
    });
    await store.saveEntities(doc);

    const result = await applyLookupResolution(
      input({ extraUris: ['https://viaf.org/viaf/12345/'] }),
      { store, packIds, readPackFile },
    );
    expect(result).toMatchObject({ status: 'linked', key: id, wasCreated: false });

    const after = await store.loadEntities();
    const idnos = Array.from(after.getElementsByTagName('idno')).map((el) => [
      el.getAttribute('type'),
      el.textContent,
    ]);
    expect(idnos).toEqual(
      expect.arrayContaining([
        ['VIAF', '12345'],
        ['Wikidata', 'Q712570'],
        ['CBDB', '31305'],
      ]),
    );
  });
});

describe('appendExtraAuthorityIds', () => {
  it('attaches parsed authority ids from extra uris onto an already-linked entity', async () => {
    const { store } = makeStore();
    const doc = await store.loadEntities();
    const { id } = addEntity(doc, 'person', { name: '沈攸之' });
    await store.saveEntities(doc);

    await appendExtraAuthorityIds(
      id,
      ['https://www.wikidata.org/wiki/Q712570', 'https://viaf.org/viaf/12345/'],
      { store },
    );

    const after = await store.loadEntities();
    const element = findEntity(after, id)!;
    const idnos = Array.from(element.getElementsByTagName('idno')).map((el) => [
      el.getAttribute('type'),
      el.textContent,
    ]);
    expect(idnos).toEqual(
      expect.arrayContaining([
        ['Wikidata', 'Q712570'],
        ['VIAF', '12345'],
      ]),
    );
  });

  it('does not duplicate an idno the entity already carries', async () => {
    const { store } = makeStore();
    const doc = await store.loadEntities();
    const { id } = addEntity(doc, 'person', {
      name: '沈攸之',
      authorityIds: [{ type: 'Wikidata', value: 'Q712570' }],
    });
    await store.saveEntities(doc);

    await appendExtraAuthorityIds(id, ['https://www.wikidata.org/wiki/Q712570'], { store });

    const after = await store.loadEntities();
    const element = findEntity(after, id)!;
    const wikidataIdnos = Array.from(element.getElementsByTagName('idno')).filter(
      (el) => el.getAttribute('type') === 'Wikidata',
    );
    expect(wikidataIdnos).toHaveLength(1);
  });

  it('is a no-op when no extra uris parse to a known authority', async () => {
    const { store } = makeStore();
    const doc = await store.loadEntities();
    const { id } = addEntity(doc, 'person', { name: '沈攸之' });
    await store.saveEntities(doc);

    await appendExtraAuthorityIds(id, ['https://example.org/people/42'], { store });

    const after = await store.loadEntities();
    const element = findEntity(after, id)!;
    expect(element.getElementsByTagName('idno')).toHaveLength(0);
  });
});

describe('linkLocalEntityWithoutAuthority', () => {
  it('mints a local-only entity and returns its key', async () => {
    const { store } = makeStore();
    const result = await linkLocalEntityWithoutAuthority('person', '江祀', { store });
    expect(result).toMatchObject({
      status: 'linked',
      entityName: '江祀',
      wasCreated: true,
    });
    expect(result.key).toMatch(/^person-[0-9a-f-]{36}$/);

    const doc = await store.loadEntities();
    const person = findEntity(doc, result.key!);
    expect(person?.getElementsByTagName('idno').length).toBe(0);
    expect(person?.getElementsByTagName('persName')[0]?.textContent).toBe('江祀');
  });

  it('reuses an existing entity when the surface matches a stored name exactly', async () => {
    const { store } = makeStore();
    const doc = await store.loadEntities();
    const { id } = addEntity(doc, 'person', { name: '江祀' });
    await store.saveEntities(doc);

    const result = await linkLocalEntityWithoutAuthority('person', '江祀', { store });
    expect(result).toMatchObject({
      status: 'linked',
      key: id,
      entityName: '江祀',
      wasCreated: false,
    });
  });

  it('splits family/given and romanizes as one concatenated word for a Chinese person with no authority match', async () => {
    const { store } = makeStore();
    const result = await linkLocalEntityWithoutAuthority('person', '周世雄', {
      store,
      projectLang: 'zh-Hant',
    });
    expect(result.wasCreated).toBe(true);

    const doc = await store.loadEntities();
    const person = findEntity(doc, result.key!);
    const romanized = Array.from(person!.getElementsByTagName('persName')).find(
      (el) => el.getAttribute('xml:lang') === 'zh-Latn',
    );
    // "Zhou Shixiong", not the per-character "Zhou Shi Xiong".
    expect(romanized?.textContent).toBe('Zhou Shixiong');

    const notes = Array.from(person!.getElementsByTagName('note'));
    expect(notes.find((n) => n.getAttribute('type') === 'familyName')?.textContent).toBe('周');
    expect(notes.find((n) => n.getAttribute('type') === 'givenName')?.textContent).toBe('世雄');
  });
});

describe('linkWithoutEnrichment', () => {
  it('links the chosen entity, writes no idnos, files a concordance warning', async () => {
    const { fs, store } = makeStore();
    const doc = await store.loadEntities();
    const a = addEntity(doc, 'person', { name: 'A', authorityIds: [{ type: 'CBDB', value: '31305' }] });
    const b = addEntity(doc, 'person', { name: 'B', authorityIds: [{ type: 'DILA', value: 'A001492' }] });
    await store.saveEntities(doc);
    const before = await store.loadEntities().then((d) => d.getElementsByTagName('idno').length);

    const result = await linkWithoutEnrichment(
      a.id,
      'A',
      [
        { key: a.id, name: 'A' },
        { key: b.id, name: 'B' },
      ],
      input(),
      { store },
    );
    expect(result).toMatchObject({ status: 'linked', key: a.id, wasCreated: false });

    const after = await store.loadEntities().then((d) => d.getElementsByTagName('idno').length);
    expect(after).toBe(before);

    const warnings = fs.files.get('/proj/.ljb/entity-warnings.jsonl') ?? '';
    expect(warnings).toContain('concordance-conflict');
    expect(warnings).toContain(b.id);
  });
});
