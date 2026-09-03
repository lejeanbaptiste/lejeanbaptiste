#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePagesTags, extractPageContent, expandPagesTranscription } from './proofreadPages.mjs';
import { wikitextToBodyXml } from './wikitextToTei.mjs';

test('parsePagesTags: reads index/from/to/fromsection/tosection, unquoted or quoted, mixed case', () => {
  const wikitext =
    '<div>\n<pages index="Foo.pdf" From=3 to=5 fromsection="part1" tosection="part2"/>\n</div>';
  const [tag] = parsePagesTags(wikitext);
  assert.equal(tag.index, 'Foo.pdf');
  assert.equal(tag.from, 3);
  assert.equal(tag.to, 5);
  assert.equal(tag.fromsection, 'part1');
  assert.equal(tag.tosection, 'part2');
});

test('parsePagesTags: to defaults to from (single-page transclusion)', () => {
  const [tag] = parsePagesTags('<pages index="Foo.pdf" from="9"/>');
  assert.equal(tag.from, 9);
  assert.equal(tag.to, 9);
});

test('parsePagesTags: a tag with no index/from is ignored, not a crash', () => {
  assert.deepEqual(parsePagesTags('<pages foo="bar"/>'), []);
  assert.deepEqual(parsePagesTags('plain text, no tag'), []);
});

test('extractPageContent: drops noinclude furniture and section markers, keeps the text between them', () => {
  const raw =
    '<noinclude><pagequality level="3" user="X"/></noinclude><section begin="part1"/>' +
    '<div style="margin-left: 3em;">real proofread text</div>' +
    '<section end="part1"/><noinclude></noinclude>';
  const content = extractPageContent(raw, {});
  assert.equal(content, '<div style="margin-left: 3em;">real proofread text</div>');
});

test('extractPageContent: fromsection skips content before the named begin marker', () => {
  const raw = 'before<section begin="part1"/>kept<section end="part1"/>';
  const content = extractPageContent(raw, { fromsection: 'part1' });
  assert.equal(content, 'kept');
});

test('extractPageContent: tosection skips content after the named end marker', () => {
  const raw = '<section begin="part2"/>kept<section end="part2"/>after';
  const content = extractPageContent(raw, { tosection: 'part2' });
  assert.equal(content, 'kept');
});

test('extractPageContent: an absent named section is a no-op, not data loss', () => {
  const raw = 'whole page text, no section tags at all';
  assert.equal(extractPageContent(raw, { fromsection: 'missing' }), raw);
});

test('expandPagesTranscription: stitches a Page: range into {{pb|n=}}-prefixed text, honoring from/tosection on the boundary pages only', async () => {
  const fixtures = {
    'Page:Foo.pdf/3':
      '<noinclude><pagequality level="3"/></noinclude><section begin="part1"/>page three text<section end="part1"/><noinclude></noinclude>',
    'Page:Foo.pdf/4': '<noinclude></noinclude>middle page whole text<noinclude></noinclude>',
    'Page:Foo.pdf/5':
      '<noinclude></noinclude><section begin="part2"/>page five kept<section end="part2"/>page five dropped<noinclude></noinclude>',
  };
  const calls = [];
  const fetchPageWikitext = async (apiHost, title) => {
    calls.push(title);
    if (!(title in fixtures)) throw new Error(`unexpected title ${title}`);
    return { wikitext: fixtures[title], pageTitle: title };
  };

  const wikitext =
    '{{header|title=X}}\n<div>\n<pages index="Foo.pdf" from=3 to=5 fromsection="part1" tosection="part2"/>\n</div>';
  const expanded = await expandPagesTranscription(wikitext, 'wikisource.org', {
    fetchPageWikitext,
    sleep: async () => {},
  });

  assert.deepEqual(calls, ['Page:Foo.pdf/3', 'Page:Foo.pdf/4', 'Page:Foo.pdf/5']);
  assert.match(expanded, /\{\{pb\|n=3\}\}page three text/);
  assert.match(expanded, /\{\{pb\|n=4\}\}middle page whole text/);
  assert.match(expanded, /\{\{pb\|n=5\}\}page five kept/);
  assert.doesNotMatch(expanded, /page five dropped/);
  // The {{header}} outside the <pages/> tag is untouched.
  assert.match(expanded, /\{\{header\|title=X\}\}/);
});

test('expandPagesTranscription: no <pages/> tag is a no-op', async () => {
  const wikitext = 'plain wikitext, nothing to expand';
  const expanded = await expandPagesTranscription(wikitext, 'wikisource.org', {
    fetchPageWikitext: async () => {
      throw new Error('should not be called');
    },
  });
  assert.equal(expanded, wikitext);
});

test('expandPagesTranscription: a page fetch failure contributes just its pb, not a thrown error', async () => {
  const fetchPageWikitext = async (apiHost, title) => {
    if (title === 'Page:Foo.pdf/2') throw new Error('404');
    return { wikitext: 'ok text', pageTitle: title };
  };
  const expanded = await expandPagesTranscription(
    '<pages index="Foo.pdf" from=1 to=2/>',
    'wikisource.org',
    {
      fetchPageWikitext,
      sleep: async () => {},
    },
  );
  assert.match(expanded, /\{\{pb\|n=1\}\}ok text/);
  assert.match(expanded, /\{\{pb\|n=2\}\}(\n\n|$)/);
});

test('end to end: an expanded <pages/> transclusion produces real <pb>-delimited paragraphs, not header debris', async () => {
  const fixtures = {
    'Page:Foo.pdf/3':
      '<noinclude><pagequality level="3"/></noinclude><section begin="part1"/>First page prose.<section end="part1"/><noinclude/>',
    'Page:Foo.pdf/4':
      '<noinclude/><section begin="part1"/>Second page prose.<section end="part1"/><noinclude/>',
  };
  const wikitext = `{{header
| title={{xx-larger|Nested Title}}
| year= 1990
| author=Someone
}}
<div style="margin-left: 3em;">
<pages index="Foo.pdf" from=3 to=4 fromsection="part1" tosection="part1"/>
</div>
`;
  const expanded = await expandPagesTranscription(wikitext, 'wikisource.org', {
    fetchPageWikitext: async (apiHost, title) => ({ wikitext: fixtures[title], pageTitle: title }),
    sleep: async () => {},
  });
  const result = wikitextToBodyXml(expanded, { locale: 'generic' });
  assert.equal(result.header?.author, 'Someone');
  assert.match(result.bodyXml, /<pb n="3"\/>/);
  assert.match(result.bodyXml, /<pb n="4"\/>/);
  assert.match(result.bodyXml, /First page prose\./);
  assert.match(result.bodyXml, /Second page prose\./);
  assert.doesNotMatch(result.bodyXml, /year=|author=/);
});
