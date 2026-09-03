#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { wikitextToBodyXml } from './wikitextToTei.mjs';
import { isPersonItem, summarizeWikidataWork } from './wikidata.mjs';

const assertWellFormedBody = (bodyXml) => {
  const doc = new DOMParser().parseFromString(`<root>${bodyXml}</root>`, 'text/xml');
  const err = doc.getElementsByTagName('parsererror');
  assert.equal(err.length, 0, err[0]?.textContent ?? 'XML parse error');
  assert.doesNotMatch(bodyXml, /<(?!\/?(?:p|pb|note)\b|pb\b[^>]*\/>)/);
};

test('zh map consumes header, maps pb and comm notes, strips unknown templates', () => {
  const wikitext = `{{header
 | title = 荀子
 | author = 荀子
 | section = 勸學篇
}}

學不可以已。〈舊注〉

{{pb|n=1a}}君子曰：學不可以已。

{{unknown|foo}}段落。
`;
  const result = wikitextToBodyXml(wikitext, { locale: 'zh' });
  assert.equal(result.header?.title, '荀子');
  assert.equal(result.header?.author, '荀子');
  assert.match(result.bodyXml, /<note type="comm">舊注<\/note>/);
  assert.match(result.bodyXml, /<pb n="1a"\/>/);
  assert.equal(result.hasPb, true);
  assert.doesNotMatch(result.bodyXml, /unknown/);
  assert.doesNotMatch(result.bodyXml, /header/);
});

test('Page links become pb milestones', () => {
  const result = wikitextToBodyXml('甲[[Page:Foo.djvu/12]]乙', { locale: 'zh' });
  assert.match(result.bodyXml, /<pb n="12"\/>/);
});

test('generic locale strips templates and keeps paragraphs', () => {
  const result = wikitextToBodyXml('{{header|title=Hi}}\n\nHello world.', { locale: 'generic' });
  assert.match(result.bodyXml, /<p>Hello world\.<\/p>/);
  assert.equal(result.hasPb, false);
});

test('generic locale: header extracted (not just stripped) and a nested template in title= does not leak leftover args', () => {
  // bo.wikisource-style header confirmed live 2026-09-03: `title=` nests
  // `{{xx-larger|...}}`. A naive `{{[^}]*}}` strip only eats up to the first
  // `}}` (the inner template's), leaving `| year=...| previous=...` etc as
  // literal text in the body — this must not happen.
  const wikitext = `{{header
| title={{xx-larger|ཤེས་རབ་སྙིང་པོའི་འགྲེལ་པ}}
| year= 1990
| previous=
| next=
| section= དཀར་ཆག
| author=ཨ་ལག་ཤ་
}}

Real body text here.
`;
  const result = wikitextToBodyXml(wikitext, { locale: 'generic' });
  assert.equal(result.header?.author, 'ཨ་ལག་ཤ་');
  assert.match(result.bodyXml, /<p>Real body text here\.<\/p>/);
  assert.doesNotMatch(result.bodyXml, /year=|previous=|next=|section=|author=/);
});

test('presentational tags like <big> are unwrapped, not escaped as literal text', () => {
  const result = wikitextToBodyXml('<big>Loud text.</big>', { locale: 'generic' });
  assert.match(result.bodyXml, /<p>Loud text\.<\/p>/);
  assert.doesNotMatch(result.bodyXml, /big/);
});

test('[[Category:…]] links are dropped, not rendered as a stray paragraph', () => {
  const result = wikitextToBodyXml(
    'Real prose.\n\n[[Category:Tibetan]]\n[[分類:Foo]]',
    { locale: 'generic' },
  );
  assert.match(result.bodyXml, /<p>Real prose\.<\/p>/);
  assert.doesNotMatch(result.bodyXml, /Category|分類/);
});

test('a category link mixed into a real paragraph is dropped, the rest of the text stays', () => {
  const result = wikitextToBodyXml('Before.[[Category:Tibetan]]After.', { locale: 'generic' });
  assert.match(result.bodyXml, /<p>Before\.After\.<\/p>/);
});

test('header field values are resolved to plain text, not left as raw wikitext markup', () => {
  // title={{xx-larger|[[Some Title]]}} — a typographic wrapper around a link,
  // confirmed live on bo.wikisource content 2026-09-03. This value is later
  // embedded as a plain citation string (headerCredit in
  // WikisourceImportDialog.tsx), which already XML-escapes it itself — so the
  // conversion here must produce clean text, not markup or XML entities.
  const wikitext = '{{header|title={{xx-larger|[[Some Title]]}}|author=[[Jane Doe|Doe, J.]]}}\n\nBody.';
  const result = wikitextToBodyXml(wikitext, { locale: 'generic' });
  assert.equal(result.header?.title, 'Some Title');
  assert.equal(result.header?.author, 'Doe, J.');
});

test('missing page breaks set hasPb false', () => {
  const result = wikitextToBodyXml('只有正文。', { locale: 'zh' });
  assert.equal(result.hasPb, false);
});

test('strips html comments, wrapper tags, and escapes raw angle brackets', () => {
  const wikitext = `<!--
editor note
-->
{{SKQS header|title=周髀算經|section=卷上之二}}
<onlyinclude><poem>正文<子部,天文算法類,推步之屬,周髀算經,卷上之二>續</poem></onlyinclude>`;
  const result = wikitextToBodyXml(wikitext, { locale: 'zh' });
  assert.doesNotMatch(result.bodyXml, /<!--/);
  assert.doesNotMatch(result.bodyXml, /<onlyinclude>|<poem>/);
  assert.match(result.bodyXml, /&lt;子部,天文算法類,推步之屬,周髀算經,卷上之二&gt;/);
  assertWellFormedBody(result.bodyXml);
});

test('maps SK notes templates to comm notes', () => {
  const result = wikitextToBodyXml('正文{{SK notes|案此條多脱誤}}後', { locale: 'zh' });
  assert.match(result.bodyXml, /<note type="comm">案此條多脱誤<\/note>/);
  assertWellFormedBody(result.bodyXml);
});

test('summarizeWikidataWork prefers labels and P50 authors', () => {
  const work = {
    id: 'Q6722310',
    labels: { 'zh-hant': { value: '荀子' }, en: { value: 'Xunzi' } },
    claims: {
      P31: [{ mainsnak: { datavalue: { value: { id: 'Q7725634' } } } }],
      P50: [{ mainsnak: { datavalue: { value: { id: 'Q216072' } } } }],
      P4517: [{ mainsnak: { datavalue: { value: 'ctp:work:xunzi' } } }],
      P577: [{ mainsnak: { datavalue: { value: { time: '+0200-01-01T00:00:00Z' } } } }],
    },
  };
  const extras = {
    Q216072: { id: 'Q216072', labels: { zh: { value: '荀子' } } },
  };
  const summary = summarizeWikidataWork(work, extras);
  assert.equal(summary.qid, 'Q6722310');
  assert.equal(summary.title, '荀子');
  assert.equal(summary.ctextWorkId, 'ctp:work:xunzi');
  assert.equal(summary.publicationDate, '0200-01-01');
  assert.equal(summary.authors[0].name, '荀子');
  assert.equal(summary.isPerson, false);
});

test('person P31 is detected', () => {
  assert.equal(
    isPersonItem({
      claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }] },
    }),
    true,
  );
});
