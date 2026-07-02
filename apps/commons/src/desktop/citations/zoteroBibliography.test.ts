import type { CslJsonItem } from './types';
import {
  biblIdForUri,
  collectCitationRefs,
  ensureStandOffListBibl,
  garbageCollectBibl,
  readBiblEntries,
  readJsonPayload,
  upsertBiblEntry,
  writeJsonPayload,
} from './zoteroBibliography';

const parse = (xml: string): Document => new DOMParser().parseFromString(xml, 'application/xml');

const roundTrip = (doc: Document): Document => parse(new XMLSerializer().serializeToString(doc));

const SHELL = `<?xml version="1.0"?>
<translation xml:lang="fr" corresp="chapter.xml">
  <div type="chapter" corresp="chapter.xml#ch1">
    <p corresp="chapter.xml#p1">Texte traduit.</p>
  </div>
</translation>`;

const ITEM: CslJsonItem = {
  id: 'ABCD1234',
  type: 'book',
  title: 'Une histoire',
  author: [{ family: 'Morgan', given: 'Daniel' }],
  issued: { 'date-parts': [[2020]] },
};

const URI = 'http://zotero.org/users/12345/items/ABCD1234';

const addRef = (doc: Document, biblId: string, locator?: string) => {
  const p = doc.getElementsByTagName('p')[0]!;
  const note = doc.createElement('note');
  note.setAttribute('place', 'foot');
  const bibl = doc.createElement('bibl');
  bibl.setAttribute('type', 'zotero-ref');
  bibl.setAttribute('corresp', `#${biblId}`);
  if (locator) {
    bibl.setAttribute('data-locator', locator);
    bibl.setAttribute('data-locator-type', 'page');
  }
  bibl.textContent = 'Morgan, Une histoire.';
  note.appendChild(bibl);
  p.appendChild(note);
};

describe('biblIdForUri', () => {
  test('derives a deterministic id from the item key', () => {
    expect(biblIdForUri(URI)).toBe('zbib-ABCD1234');
    expect(biblIdForUri(`${URI}/`)).toBe('zbib-ABCD1234');
  });

  test('sanitizes characters not valid in xml:id', () => {
    expect(biblIdForUri('http://x/items/AB CD')).toBe('zbib-AB_CD');
  });
});

describe('JSON payload CDATA round-trip', () => {
  test('survives serialization', () => {
    const doc = parse(SHELL);
    const el = doc.createElement('note');
    doc.documentElement.appendChild(el);
    writeJsonPayload(el, ITEM);
    const back = roundTrip(doc);
    const note = back.getElementsByTagName('note')[0]!;
    expect(readJsonPayload(note)).toEqual(ITEM);
  });

  test('handles ]]> inside the payload', () => {
    const doc = parse(SHELL);
    const el = doc.createElement('note');
    doc.documentElement.appendChild(el);
    const payload = { title: 'weird ]]> title', nested: 'a]]>b]]>c' };
    writeJsonPayload(el, payload);
    expect(readJsonPayload(el)).toEqual(payload);
    const back = roundTrip(doc);
    expect(readJsonPayload(back.getElementsByTagName('note')[0]!)).toEqual(payload);
  });
});

describe('ensureStandOffListBibl', () => {
  test('creates standOff as first child of the root', () => {
    const doc = parse(SHELL);
    ensureStandOffListBibl(doc);
    expect(doc.documentElement.firstElementChild?.localName).toBe('standOff');
    expect(doc.documentElement.firstElementChild?.firstElementChild?.localName).toBe('listBibl');
  });

  test('is idempotent', () => {
    const doc = parse(SHELL);
    const first = ensureStandOffListBibl(doc);
    const second = ensureStandOffListBibl(doc);
    expect(first).toBe(second);
    expect(doc.getElementsByTagName('standOff')).toHaveLength(1);
  });
});

describe('upsertBiblEntry / readBiblEntries', () => {
  test('stores an entry with uri and CSL snapshot', () => {
    const doc = parse(SHELL);
    const id = upsertBiblEntry(doc, ITEM, URI);
    expect(id).toBe('zbib-ABCD1234');
    const entries = readBiblEntries(roundTrip(doc));
    expect(entries.get(id)?.uri).toBe(URI);
    expect(entries.get(id)?.csl).toEqual(ITEM);
  });

  test('re-citing the same item dedupes and refreshes the snapshot', () => {
    const doc = parse(SHELL);
    upsertBiblEntry(doc, ITEM, URI);
    upsertBiblEntry(doc, { ...ITEM, title: 'Nouvelle édition' }, URI);
    const entries = readBiblEntries(doc);
    expect(entries.size).toBe(1);
    expect(entries.get('zbib-ABCD1234')?.csl.title).toBe('Nouvelle édition');
  });
});

describe('collectCitationRefs', () => {
  test('finds zotero-ref bibls with locator data, ignoring standOff entries', () => {
    const doc = parse(SHELL);
    const id = upsertBiblEntry(doc, ITEM, URI);
    addRef(doc, id, '45-47');
    const refs = collectCitationRefs(doc);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ biblId: id, locator: '45-47', locatorType: 'page' });
  });
});

describe('garbageCollectBibl', () => {
  test('keeps referenced entries and drops orphans', () => {
    const doc = parse(SHELL);
    const kept = upsertBiblEntry(doc, ITEM, URI);
    upsertBiblEntry(
      doc,
      { id: 'ZZZZ9999', type: 'book' },
      'http://zotero.org/users/12345/items/ZZZZ9999',
    );
    addRef(doc, kept);
    garbageCollectBibl(doc);
    const entries = readBiblEntries(doc);
    expect(Array.from(entries.keys())).toEqual([kept]);
  });

  test('removes empty standOff entirely when nothing is cited', () => {
    const doc = parse(SHELL);
    upsertBiblEntry(doc, ITEM, URI);
    garbageCollectBibl(doc);
    expect(doc.getElementsByTagName('standOff')).toHaveLength(0);
  });

  test('is a no-op on documents without standOff', () => {
    const doc = parse(SHELL);
    expect(() => garbageCollectBibl(doc)).not.toThrow();
  });
});
