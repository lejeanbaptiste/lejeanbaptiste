#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseNTriples,
  fetchEtextBase,
  fetchChunks,
  fetchInstanceBibl,
  fetchRevision,
  importEtext,
} from './pdiClient.mjs';
import { etextToBodyXml, etextHeaderFields } from './etextToTei.mjs';

const CORE = 'http://purl.bdrc.io/ontology/core/';
const ADM = 'http://purl.bdrc.io/ontology/admin/';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const SKOS = 'http://www.w3.org/2004/02/skos/core#';
const R = 'http://purl.bdrc.io/resource/';
const A = 'http://purl.bdrc.io/admindata/';
const UT = 'UT4CZ5369_I1KG9127_0000';

// `/resource/MW…` describe graph: edition statement on the instance, publication
// year on a `PublishedEvent` blank node, publisher name + place.
const instanceNt = ({ year = '1737', edition = 'པར་གཞི་དང་པོ།', event = true } = {}) =>
  `
<${R}MW4CZ5369> <${CORE}editionStatement> "${edition}"@bo .
<${R}MW4CZ5369> <${CORE}publisherName> "སྡེ་དགེ་པར་ཁང་"@bo .
<${R}MW4CZ5369> <${CORE}publisherLocation> "sde dge" .
` +
  (event
    ? `<${R}MW4CZ5369> <${CORE}instanceEvent> _:ev1 .
_:ev1 <${RDF}type> <${CORE}PublishedEvent> .
_:ev1 <${CORE}onYear> "${year}"^^<${XSD}gYear> .
`
    : '');

// Real instance chain (confirmed live 2026-08-31):
//   UT --eTextInInstance--> IE --instanceOf--> WA
//                              --instanceReproductionOf--> W, MW
// Image group is NOT in Etext_base — it arrives via chunkContext (inImageGroup).
const etextBaseNt = (access = 'AccessOpen', status = 'StatusReleased') => `
# Etext_base fixture
<${R}${UT}> <${CORE}eTextInInstance> <${R}IE4CZ5369> .
<${R}${UT}> <${CORE}etextIsPaginated> "true" .
<${R}${UT}> <${SKOS}prefLabel> "འདུལ་བ་ཀ"@bo .
<${R}IE4CZ5369> <${CORE}instanceOf> <${R}WA0BC001> .
<${R}IE4CZ5369> <${CORE}instanceReproductionOf> <${R}W4CZ5369> .
<${R}IE4CZ5369> <${CORE}instanceReproductionOf> <${R}MW4CZ5369> .
<${R}EIadm_x> <${ADM}adminAbout> <${R}IE4CZ5369> .
<${R}EIadm_x> <${ADM}access> <${A}${access}> .
<${R}EIadm_x> <${ADM}status> <${A}${status}> .
`;

// Two chunks over [0,10) and [10,25); two pages aligned to them.
const CHUNKS = [
  { id: 'EC_a', s: 0, e: 10, text: 'AAAAAAAAAA' },
  { id: 'EC_b', s: 10, e: 25, text: 'BBBBB\nBBBBBBBBB' },
];
const PAGES = [
  { id: 'EP_1', seq: 1, s: 0, e: 10, part: 'MW4CZ5369_0001_1' },
  { id: 'EP_2', seq: 2, s: 10, e: 25, part: 'MW4CZ5369_0001_2' },
];

const chunkTriples = (c) =>
  `<${R}${c.id}> <${CORE}chunkContents> "${c.text.replace(/\n/g, '\\n')}" .\n` +
  `<${R}${c.id}> <${CORE}sliceStartChar> "${c.s}" .\n` +
  `<${R}${c.id}> <${CORE}sliceEndChar> "${c.e}" .\n`;

const TMP = 'http://purl.bdrc.io/ontology/tmp/';
const pageTriples = (p) =>
  `<${R}${UT}> <${CORE}eTextHasPage> <${R}${p.id}> .\n` +
  `<${R}${p.id}> <${CORE}seqNum> "${p.seq}" .\n` +
  `<${R}${p.id}> <${CORE}sliceStartChar> "${p.s}" .\n` +
  `<${R}${p.id}> <${CORE}sliceEndChar> "${p.e}" .\n` +
  (p.part
    ? `<${R}${p.id}> <${TMP}inInstancePart> <${R}MW4CZ5369_0001> .\n` +
      `<${R}${p.id}> <${TMP}inInstancePart> <${R}${p.part}> .\n`
    : '');

const chunkContextNt = (start, end) => {
  const overlaps = (s, e) => s < end && e > start;
  return (
    `<${R}${UT}> <${CORE}inImageGroup> <${R}I1KG9127> .\n` +
    CHUNKS.filter((c) => overlaps(c.s, c.e))
      .map(chunkTriples)
      .join('') +
    PAGES.filter((p) => overlaps(p.s, p.e))
      .map(pageTriples)
      .join('')
  );
};

const REVISION = '7bc97bc57bcb4b03a1f7392f4dd9cbda0f3a0906';
const adminNt = (rev = REVISION) =>
  `<${R}${UT}> <${ADM}contentsGitRevision> "${rev}" .\n` +
  `<${R}${UT}> <${ADM}status> <${A}StatusReleased> .\n`;

/** A fetch stub that records calls and serves the fixtures above. */
const makeFetch = (opts = {}) => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const u = new URL(url);
    const ok = (body) => ({ ok: true, status: 200, text: async () => body });
    if (u.pathname.endsWith('/query/graph/Etext_base')) {
      // A degenerate (near-empty) response — as the PDI gives for an id that
      // resolves to nothing usable, e.g. an OpenPecha volume.
      if (opts.degenerate) return ok(`<${R}${UT}> <${CORE}type> <${CORE}Etext> .\n`);
      return ok(etextBaseNt(opts.access, opts.status));
    }
    if (u.pathname.endsWith('/query/graph/chunkContext')) {
      const s = Number(u.searchParams.get('I_START'));
      const e = Number(u.searchParams.get('I_END'));
      return ok(chunkContextNt(s, e));
    }
    if (u.pathname.startsWith('/admindata/')) {
      return opts.noRevision ? { ok: false, status: 404, text: async () => '' } : ok(adminNt());
    }
    if (u.pathname.startsWith('/resource/')) {
      if (opts.noInstanceBibl) return { ok: false, status: 404, text: async () => '' };
      return ok(instanceNt(opts.instance));
    }
    return { ok: false, status: 404, text: async () => '' };
  };
  return { fetchImpl, calls };
};

test('parseNTriples: uri objects, language literals, int literals, comments skipped', () => {
  const triples = parseNTriples(`
# a comment
<${R}x> <${SKOS}prefLabel> "hello"@bo-x-ewts .
<${R}x> <${CORE}sliceStartChar> "42" .
<${R}x> <${CORE}eTextInInstance> <${R}MW1> .

`);
  assert.equal(triples.length, 3);
  assert.deepEqual(triples[0], {
    s: `${R}x`,
    p: `${SKOS}prefLabel`,
    o: 'hello',
    literal: true,
    lang: 'bo-x-ewts',
    datatype: null,
  });
  assert.equal(triples[1].o, '42');
  assert.equal(triples[2].literal, false);
  assert.equal(triples[2].o, `${R}MW1`);
});

test('parseNTriples unescapes \\n inside literals', () => {
  const [t] = parseNTriples(`<${R}x> <${CORE}chunkContents> "line1\\nline2" .`);
  assert.equal(t.o, 'line1\nline2');
});

test('fetchEtextBase: resolves the UT→IE→(WA / MW) instance chain and title', async () => {
  const { fetchImpl } = makeFetch();
  const base = await fetchEtextBase(`bdr:${UT}`, { fetchImpl });
  assert.equal(base.access, 'AccessOpen');
  assert.equal(base.status, 'StatusReleased');
  assert.equal(base.paginated, true);
  assert.equal(base.etextInstanceId, 'IE4CZ5369');
  assert.equal(base.scanInstanceId, 'MW4CZ5369'); // MW preferred over W
  assert.equal(base.workId, 'WA0BC001'); // IE instanceOf → abstract work
  assert.equal(base.imageGroupId, null); // not in Etext_base
  assert.equal(base.title, 'འདུལ་བ་ཀ');
});

test('fetchInstanceBibl: edition statement, ISO publication year, publisher + place', async () => {
  const { fetchImpl, calls } = makeFetch();
  const bibl = await fetchInstanceBibl('bdr:MW4CZ5369', { fetchImpl });
  assert.ok(
    calls.some((u) => u.endsWith('/resource/MW4CZ5369.nt')),
    'hits the instance describe graph',
  );
  assert.equal(bibl.edition, 'པར་གཞི་དང་པོ།');
  assert.equal(bibl.editionLang, 'bo');
  assert.deepEqual(bibl.editionDate, { when: '1737' });
  assert.equal(bibl.publisher, 'སྡེ་དགེ་པར་ཁང་');
  assert.equal(bibl.pubPlace, 'sde dge');
});

test('fetchInstanceBibl: a fuzzy (non 4-digit) year is dropped, not emitted', async () => {
  const { fetchImpl } = makeFetch({ instance: { year: 'circa 18th c.' } });
  const bibl = await fetchInstanceBibl('MW4CZ5369', { fetchImpl });
  assert.equal(bibl.editionDate, null);
  assert.equal(bibl.edition, 'པར་གཞི་དང་པོ།'); // edition still comes through
});

test('fetchInstanceBibl: a 404 on the instance record is swallowed', async () => {
  const { fetchImpl } = makeFetch({ noInstanceBibl: true });
  const bibl = await fetchInstanceBibl('MW4CZ5369', { fetchImpl });
  assert.deepEqual(bibl, {
    edition: '',
    editionLang: null,
    editionDate: null,
    publisher: '',
    pubPlace: '',
  });
});

test('importEtext: edition / publication year / reader URL land on meta', async () => {
  const { fetchImpl } = makeFetch();
  const { extracted } = await importEtext(`bdr:${UT}`, {
    fetchImpl,
    windowSize: 8,
    readerUrl: 'https://library.bdrc.io/show/bdr:IE4CZ5369?openEtext=bdr:VE4CZ5369_I1KG9127',
  });
  assert.equal(extracted.meta.edition, 'པར་གཞི་དང་པོ།');
  assert.deepEqual(extracted.meta.editionDate, { when: '1737' });
  assert.equal(extracted.meta.publisher, 'སྡེ་དགེ་པར་ཁང་');
  assert.equal(extracted.meta.instanceUri, `${R}MW4CZ5369`);
  assert.match(extracted.meta.readerUrl, /openEtext=bdr:VE4CZ5369/);

  const header = etextHeaderFields(extracted);
  assert.equal(header.edition, 'པར་གཞི་དང་པོ།');
  assert.deepEqual(header.editionDate, { when: '1737' });
  assert.match(header.readerUrl, /library\.bdrc\.io/);
});

test('fetchChunks: windows the volume, dedupes, sorts, collects pages + image group + parts', async () => {
  const { fetchImpl, calls } = makeFetch();
  const { chunks, pages, imageGroupId, parts } = await fetchChunks(UT, {
    fetchImpl,
    windowSize: 8,
  });
  assert.equal(imageGroupId, 'I1KG9127');
  // deepest inInstancePart per page → bam po boundaries; part 1 absorbs char 0.
  assert.deepEqual(
    parts.map((p) => [p.n, p.startChar]),
    [
      [1, 0],
      [2, 10],
    ],
  );
  assert.deepEqual(
    chunks.map((c) => [c.id, c.startChar, c.endChar]),
    [
      ['EC_a', 0, 10],
      ['EC_b', 10, 25],
    ],
  );
  assert.equal(chunks[1].text, 'BBBBB\nBBBBBBBBB');
  assert.deepEqual(
    pages.map((p) => [p.seqNum, p.startChar, p.endChar]),
    [
      [1, 0, 10],
      [2, 10, 25],
    ],
  );
  // 8-char windows: [0,8] → advance to 10, [10,18] → advance to 25, [25,33] → empty → stop.
  const ctx = calls.filter((u) => u.includes('chunkContext'));
  assert.equal(ctx.length, 3);
});

test('importEtext: assembles page-aligned ExtractedEtext for the emitter', async () => {
  const { fetchImpl } = makeFetch();
  const { extracted, restricted, warnings } = await importEtext(`bdr:${UT}`, {
    fetchImpl,
    windowSize: 8,
  });
  assert.equal(restricted, false);
  assert.deepEqual(warnings, []);
  assert.equal(extracted.meta.utId, UT);
  assert.equal(extracted.meta.instanceId, 'MW4CZ5369');
  assert.equal(extracted.meta.workId, 'WA0BC001');
  assert.equal(extracted.meta.volumeId, 'I1KG9127'); // recovered from chunkContext
  assert.equal(extracted.meta.facsAllowed, true);
  assert.equal(extracted.meta.attribution.startsWith('Digitised text courtesy of'), true);
  assert.equal(extracted.chunks.length, 2);
  assert.deepEqual(
    extracted.chunks.map((c) => [c.pageLabel, c.text]),
    [
      ['1', 'AAAAAAAAAA'],
      ['2', 'BBBBB\nBBBBBBBBB'],
    ],
  );
  // No imgList blob → the IIIF url is derived from image group + zero-padded seqNum.
  assert.equal(
    extracted.chunks[0].imageUri,
    'https://iiif.bdrc.io/bdr:I1KG9127::I1KG91270001.jpg/full/max/0/default.jpg',
  );
  assert.equal(extracted.meta.dataRevision, REVISION);
});

test('fetchRevision reads contentsGitRevision from /admindata; missing → ""', async () => {
  const { fetchImpl } = makeFetch();
  assert.equal(await fetchRevision(`bdr:${UT}`, { fetchImpl }), REVISION);
  const bare = makeFetch({ noRevision: true });
  assert.equal(await fetchRevision(UT, { fetchImpl: bare.fetchImpl }), '');
});

test('importEtext: second call with a cacheDir is served from disk, no network', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdrc-cache-'));
  try {
    const first = makeFetch();
    const a = await importEtext(`bdr:${UT}`, {
      fetchImpl: first.fetchImpl,
      windowSize: 8,
      cacheDir: dir,
    });
    assert.equal(a.fromCache, false);
    assert.equal(a.revision, REVISION);

    const second = makeFetch();
    const b = await importEtext(`bdr:${UT}`, {
      fetchImpl: second.fetchImpl,
      windowSize: 8,
      cacheDir: dir,
    });
    assert.equal(b.fromCache, true);
    assert.match(b.warnings.join(' '), /local cache/);
    assert.equal(b.extracted.chunks.length, 2);
    // only the revision probe hit the network on the cached call
    assert.equal(
      second.calls.some((u) => u.includes('/query/graph/')),
      false,
    );

    const third = makeFetch();
    const c = await importEtext(`bdr:${UT}`, {
      fetchImpl: third.fetchImpl,
      windowSize: 8,
      cacheDir: dir,
      forceRefresh: true,
    });
    assert.equal(c.fromCache, false);
    assert.equal(
      third.calls.some((u) => u.includes('/query/graph/chunkContext')),
      true,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('importEtext: stale cache without bam po parts is ignored and re-fetched', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdrc-cache-'));
  try {
    const stale = {
      extracted: {
        meta: { utId: UT, title: 't', lang: 'bo', sourceUri: `${R}${UT}` },
        chunks: [{ index: 0, text: 'X', pageLabel: '1a', pageId: 'p1', startChar: 0 }],
        outline: [],
      },
      restricted: false,
      warnings: [],
      revision: REVISION,
    };
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${UT}__${REVISION}.json`), JSON.stringify(stale));

    const { fetchImpl, calls } = makeFetch();
    const result = await importEtext(`bdr:${UT}`, {
      fetchImpl,
      windowSize: 8,
      cacheDir: dir,
    });
    assert.equal(result.fromCache, false);
    assert.match(result.warnings.join(' '), /stale local cache/i);
    assert.ok(Array.isArray(result.parts));
    assert.equal(
      calls.some((u) => u.includes('/query/graph/chunkContext')),
      true,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('importEtext: no revision → never cached', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdrc-cache-'));
  try {
    const f1 = makeFetch({ noRevision: true });
    await importEtext(`bdr:${UT}`, { fetchImpl: f1.fetchImpl, windowSize: 8, cacheDir: dir });
    assert.equal(fs.readdirSync(dir).length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('importEtext: folio labels and IIIF facs come from an imgList blob', async () => {
  const { fetchImpl } = makeFetch();
  const { extracted } = await importEtext(`bdr:${UT}`, {
    fetchImpl,
    windowSize: 8,
    imgList: {
      folioLabels: { 1: '1a', 2: '1b' },
      imageFiles: { 1: 'I1KG91270001.jpg', 2: 'I1KG91270002.jpg' },
    },
  });
  assert.deepEqual(
    extracted.chunks.map((c) => c.pageLabel),
    ['1a', '1b'],
  );
  assert.equal(
    extracted.chunks[0].imageUri,
    'https://iiif.bdrc.io/bdr:I1KG9127::I1KG91270001.jpg/full/max/0/default.jpg',
  );
});

test('importEtext: restricted access yields a metadata stub and never fetches chunks', async () => {
  const { fetchImpl, calls } = makeFetch({ access: 'AccessRestrictedByTbrc' });
  const { extracted, restricted, warnings } = await importEtext(`bdr:${UT}`, { fetchImpl });
  assert.equal(restricted, true);
  assert.equal(extracted.chunks.length, 0);
  assert.equal(extracted.meta.title, 'འདུལ་བ་ཀ');
  assert.match(warnings.join(' '), /AccessRestrictedByTbrc/);
  assert.equal(
    calls.some((u) => u.includes('chunkContext')),
    false,
  );
});

test('importEtext: a degenerate Etext_base yields unsupported, no chunk fetch', async () => {
  const { fetchImpl, calls } = makeFetch({ degenerate: true });
  const { restricted, unsupported, warnings, extracted } = await importEtext(`bdr:${UT}`, {
    fetchImpl,
  });
  assert.equal(unsupported, true);
  assert.equal(restricted, true);
  assert.equal(extracted.chunks.length, 0);
  assert.match(warnings.join(' '), /no downloadable transcription|OpenPecha/i);
  assert.equal(
    calls.some((u) => u.includes('/query/graph/chunkContext')),
    false,
  );
});

test('importEtext: unreleased status is surfaced as a warning but still imports', async () => {
  const { fetchImpl } = makeFetch({ status: 'StatusWithdrawn' });
  const { warnings, restricted } = await importEtext(`bdr:${UT}`, { fetchImpl, windowSize: 8 });
  assert.equal(restricted, false);
  assert.match(warnings.join(' '), /StatusWithdrawn/);
});

test('pipeline: importEtext → etextToBodyXml → one <pb> per folio, <lb> per line', async () => {
  const { fetchImpl } = makeFetch();
  const { extracted } = await importEtext(`bdr:${UT}`, {
    fetchImpl,
    windowSize: 8,
    imgList: { folioLabels: { 1: '1a', 2: '1b' }, imageFiles: { 1: 'f1.jpg', 2: 'f2.jpg' } },
  });
  const { bodyXml, pbCount, hasFacs } = etextToBodyXml(extracted);
  assert.equal(pbCount, 2);
  assert.equal(hasFacs, true);
  assert.match(bodyXml, /<pb n="1a" facs="[^"]+f1\.jpg[^"]*"\/>[\s\S]*AAAAAAAAAA/);
  assert.match(bodyXml, /<pb n="1b" facs="[^"]+f2\.jpg[^"]*"\/>[\s\S]*BBBBB<lb\/>[\s\S]*BBBBBBBBB/);

  const header = etextHeaderFields(extracted);
  assert.equal(header.idno.find((i) => i.type === 'URI').value, `${R}${UT}`);
  assert.ok(header.idno.some((i) => i.type === 'BDRC' && i.value === 'MW4CZ5369'));
  assert.equal(header.availabilityStatus, 'free');
});

test('fetchVolumeBampoEtexts: VE volume ka exposes six fascicle etext ids', async () => {
  const { fetchVolumeBampoEtexts } = await import('./pdiClient.mjs');
  const entries = await fetchVolumeBampoEtexts('VE4CZ5369_I1KG9127');
  assert.equal(entries.length, 6);
  assert.deepEqual(
    entries.map((e) => e.seqNum),
    [1, 2, 3, 4, 5, 6],
  );
  assert.match(entries[0].utId, /_0001_1$/);
});
