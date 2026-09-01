#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { etextToBodyXml, etextHeaderFields, isContentRestricted } from './etextToTei.mjs';

const assertWellFormedBody = (bodyXml) => {
  const doc = new DOMParser().parseFromString(`<body>${bodyXml}</body>`, 'text/xml');
  const err = doc.getElementsByTagName('parsererror');
  assert.equal(err.length, 0, err[0]?.textContent ?? 'XML parse error');
};

// A short run of Tibetan with a shad (།) and tsheg (་) so we can check the
// punctuation is passed through untouched.
const BO_LINE_1 = 'བཀྲ་ཤིས་བདེ་ལེགས།';
const BO_LINE_2 = 'ཆོས་ཉིད་';

const twoFolioExtract = () => ({
  meta: {
    utId: 'UT0001',
    instanceId: 'MW22084',
    workId: 'WA22084',
    volumeId: 'I0886',
    volumeNumber: 1,
    title: 'དཔེ་ཆ།',
    lang: 'bo',
    method: 'manual',
    access: 'AccessOpen',
    facsAllowed: true,
    sourceUri: 'http://purl.bdrc.io/resource/UT0001',
  },
  chunks: [
    {
      index: 0,
      text: `${BO_LINE_1}\n${BO_LINE_2}`,
      pageId: 'I0886_0001',
      pageLabel: '1a',
      imageUri: 'https://iiif.bdrc.io/bdr:I0886::0001.jpg/full/max/0/default.jpg',
      startChar: 0,
    },
    {
      index: 1,
      text: ' གཉིས་པ།',
      pageId: 'I0886_0002',
      pageLabel: '1b',
      imageUri: 'https://iiif.bdrc.io/bdr:I0886::0002.jpg/full/max/0/default.jpg',
      startChar: 30,
    },
  ],
});

test('flat: one pb per folio, lb per line break, punctuation verbatim', () => {
  const { bodyXml, pbCount, hasFacs, structure } = etextToBodyXml(twoFolioExtract());
  assert.equal(structure, 'flat');
  assert.equal(pbCount, 2);
  assert.equal(hasFacs, true);
  assert.match(bodyXml, /<pb n="1a" facs="[^"]+0001\.jpg[^"]*"\/>/);
  assert.match(bodyXml, /<pb n="1b" facs="[^"]+0002\.jpg[^"]*"\/>/);
  assert.match(bodyXml, new RegExp(`${BO_LINE_1}<lb/>\\n${BO_LINE_2}`));
  assert.ok(bodyXml.includes('།'), 'shad kept');
  assert.ok(bodyXml.includes('་'), 'tsheg kept');
  assertWellFormedBody(bodyXml);
});

test('facs is suppressed when facsAllowed is not set', () => {
  const extract = twoFolioExtract();
  extract.meta.facsAllowed = false;
  const { bodyXml, hasFacs } = etextToBodyXml(extract);
  assert.equal(hasFacs, false);
  assert.match(bodyXml, /<pb n="1a"\/>/);
  assert.doesNotMatch(bodyXml, /facs=/);
});

test('consecutive chunks on the same folio share one pb', () => {
  const extract = twoFolioExtract();
  extract.chunks = [
    { index: 0, text: 'ཀ', pageId: 'p1', pageLabel: '1a', startChar: 0 },
    { index: 1, text: 'ཁ', pageId: 'p1', pageLabel: '1a', startChar: 1 },
    { index: 2, text: 'ག', pageId: 'p2', pageLabel: '1b', startChar: 2 },
  ];
  const { pbCount, bodyXml } = etextToBodyXml(extract);
  assert.equal(pbCount, 2);
  assert.match(bodyXml, /<ab><pb n="1a"\/>\s*ཀཁ<\/ab>\s*<ab><pb n="1b"\/>\s*ག<\/ab>/s);
});

test('each folio becomes its own block, never one paragraph for the volume', () => {
  // Guards the fix for the Visual-mode freeze: a whole fascicle in a single
  // block put ~396k characters and ~3.6k children in one <p>, and editors pay
  // layout/selection cost per block. One block per folio keeps them small.
  const chunks = [];
  for (let i = 0; i < 40; i += 1) {
    chunks.push({
      index: i,
      text: `line-${i}-a\nline-${i}-b`,
      pageId: `p${i}`,
      pageLabel: `${i + 1}a`,
      startChar: i * 10,
    });
  }
  const { bodyXml, pbCount } = etextToBodyXml({ meta: { lang: 'bo' }, chunks });
  assert.equal(pbCount, 40);
  assert.equal((bodyXml.match(/<ab>/g) ?? []).length, 40, 'one block per folio');
  assert.equal((bodyXml.match(/<p>/g) ?? []).length, 0, 'no volume-wide paragraph');
  // Every <pb/> opens a block rather than sitting mid-block.
  assert.equal((bodyXml.match(/<ab><pb\b/g) ?? []).length, 40);
  assertWellFormedBody(bodyXml);
});

test('xml special characters in the transcription are escaped', () => {
  const extract = twoFolioExtract();
  extract.chunks = [
    { index: 0, text: 'a & b < c > d', pageLabel: '1a', pageId: 'p1', startChar: 0 },
  ];
  const { bodyXml } = etextToBodyXml(extract);
  assert.match(bodyXml, /a &amp; b &lt; c &gt; d/);
  assertWellFormedBody(bodyXml);
});

test('empty chunks are dropped and an empty extract yields <p></p>', () => {
  assert.equal(etextToBodyXml({ meta: {}, chunks: [] }).bodyXml, '<p></p>');
  const { bodyXml } = etextToBodyXml({
    meta: { lang: 'bo' },
    chunks: [
      { index: 0, text: '', pageLabel: '1a' },
      { index: 1, text: 'ཀ', pageLabel: '1a', pageId: 'p1' },
    ],
  });
  assert.match(bodyXml, /<ab><pb n="1a"\/>\s*ཀ<\/ab>/s);
});

test('chunks are ordered by index, not array position', () => {
  const { bodyXml } = etextToBodyXml({
    meta: {},
    chunks: [
      { index: 2, text: 'C', pageLabel: '2a', pageId: 'p2' },
      { index: 0, text: 'A', pageLabel: '1a', pageId: 'p1' },
      { index: 1, text: 'B', pageLabel: '1a', pageId: 'p1' },
    ],
  });
  assert.match(bodyXml, /<ab><pb n="1a"\/>\s*AB<\/ab>\s*<ab><pb n="2a"\/>\s*C<\/ab>/s);
});

test('outline offsets cut the body into typed divs; forceFlat overrides', () => {
  const extract = twoFolioExtract();
  extract.chunks = [
    { index: 0, text: 'front', pageLabel: '1a', pageId: 'p1', startChar: 0 },
    { index: 1, text: 'ch-one', pageLabel: '1b', pageId: 'p2', startChar: 10 },
    { index: 2, text: 'ch-two', pageLabel: '2a', pageId: 'p3', startChar: 20 },
  ];
  extract.outline = [
    { type: 'chapter', label: 'le’u dang po', startChar: 10, level: 1 },
    { type: 'chapter', label: 'le’u gnyis pa', startChar: 20, level: 1 },
  ];
  const { bodyXml, structure } = etextToBodyXml(extract);
  assert.equal(structure, 'outline');
  assert.match(bodyXml, /<div><ab><pb n="1a"\/>\s*front<\/ab><\/div>/s);
  assert.match(
    bodyXml,
    /<div type="chapter"><head>le’u dang po<\/head><ab><pb n="1b"\/>\s*ch-one<\/ab><\/div>/s,
  );
  assert.match(
    bodyXml,
    /<div type="chapter"><head>le’u gnyis pa<\/head><ab><pb n="2a"\/>\s*ch-two<\/ab><\/div>/s,
  );
  assertWellFormedBody(bodyXml);

  const flat = etextToBodyXml(extract, { forceFlat: true });
  assert.equal(flat.structure, 'flat');
  assert.doesNotMatch(flat.bodyXml, /<div/);
});

test('outline is ignored when any offset is missing', () => {
  const extract = twoFolioExtract();
  extract.outline = [{ type: 'chapter', label: 'x' /* no startChar */ }];
  assert.equal(etextToBodyXml(extract).structure, 'flat');
});

test('header fields: purls, creator refs, idno list, availability, review flag', () => {
  const fields = etextHeaderFields({
    meta: {
      utId: 'UT0001',
      instanceId: 'MW22084',
      workId: 'WA22084',
      volumeId: 'I0886',
      title: 'དཔེ་ཆ།',
      altTitles: [{ text: 'dpe cha', lang: 'bo-x-ewts' }],
      lang: 'bo',
      method: 'ocr',
      access: 'AccessFairUse',
      attribution: 'Digitized by BDRC',
      creators: [
        { name: 'ཀློང་ཆེན་པ', id: 'P1583', lang: 'bo', role: 'author' },
        { name: 'unknown scribe', role: 'scribe' },
      ],
      sourceUri: 'http://purl.bdrc.io/resource/UT0001',
      dataRevision: 'r42',
      fetchedAt: '2026-08-31T00:00:00Z',
      importerVersion: '0.1.0',
      queryNames: ['Etext_base'],
    },
    chunks: [],
  });
  assert.equal(fields.title, 'དཔེ་ཆ།');
  assert.equal(fields.creators[0].ref, 'http://purl.bdrc.io/resource/P1583');
  assert.equal(fields.creators[0].role, 'author');
  assert.equal(fields.creators[1].ref, undefined);
  assert.deepEqual(
    fields.idno.find((i) => i.type === 'URI'),
    { type: 'URI', value: 'http://purl.bdrc.io/resource/UT0001' },
  );
  assert.ok(fields.idno.some((i) => i.type === 'BDRC' && i.value === 'MW22084'));
  assert.equal(fields.availabilityStatus, 'restricted');
  assert.equal(fields.accessTier, 'AccessFairUse');
  assert.equal(fields.reviewNeeded, true);
  assert.equal(fields.provenance.dataRevision, 'r42');
  assert.equal(fields.provenance.queryNames, 'Etext_base');
});

test('header fields: edition, ISO edition date, publisher, reader URL pass through', () => {
  const fields = etextHeaderFields({
    meta: {
      utId: 'UT0001',
      title: 't',
      edition: 'པར་གཞི་དང་པོ།',
      editionLang: 'bo',
      editionDate: { when: '1737' },
      publisher: 'sde dge par khang',
      pubPlace: 'sde dge',
      readerUrl: 'https://library.bdrc.io/show/bdr:UT0001',
    },
    chunks: [],
  });
  assert.equal(fields.edition, 'པར་གཞི་དང་པོ།');
  assert.equal(fields.editionLang, 'bo');
  assert.deepEqual(fields.editionDate, { when: '1737' });
  assert.equal(fields.publisher, 'sde dge par khang');
  assert.equal(fields.pubPlace, 'sde dge');
  assert.equal(fields.readerUrl, 'https://library.bdrc.io/show/bdr:UT0001');
});

test('header fields: an empty edition date object collapses to null', () => {
  const fields = etextHeaderFields({
    meta: { utId: 'UT0001', title: 't', editionDate: {} },
    chunks: [],
  });
  assert.equal(fields.editionDate, null);
  assert.equal(fields.edition, '');
});

test('header fields strip a bdr: prefix when building purls', () => {
  const fields = etextHeaderFields({
    meta: { utId: 'bdr:UT9', title: 't', creators: [{ name: 'n', id: 'bdr:P9', role: 'author' }] },
    chunks: [],
  });
  assert.equal(fields.sourceUri, 'http://purl.bdrc.io/resource/UT9');
  assert.equal(fields.creators[0].ref, 'http://purl.bdrc.io/resource/P9');
});

test('isContentRestricted: open and fair-use import, the rest are stubs', () => {
  assert.equal(isContentRestricted({ meta: { access: 'AccessOpen' } }), false);
  assert.equal(isContentRestricted({ meta: { access: 'AccessFairUse' } }), false);
  assert.equal(isContentRestricted({ meta: { access: 'AccessRestrictedByTbrc' } }), true);
  assert.equal(isContentRestricted({ meta: { access: 'AccessRestrictedInChina' } }), true);
  assert.equal(isContentRestricted({ meta: {} }), false);
});
