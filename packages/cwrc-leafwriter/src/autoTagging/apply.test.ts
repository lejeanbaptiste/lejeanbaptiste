import fs from 'fs';
import path from 'path';
import { collectTextNodes, createAnchor } from './anchor';
import { applySuggestions, revertToSnapshot } from './apply';
import { anchorForDateElement, findTeiBodyRoot } from './dates';
import { normalizeDomText } from './normalize';
import type { Suggestion } from './types';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const serialize = (doc: Document) => new XMLSerializer().serializeToString(doc);

const TEI = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<p>上陽子曰：老君出真文於大浮黎土。</p>
<p>又見上陽子，居<placeName>洛陽</placeName>之南。</p>
</body></text></TEI>`;

/** Build an 'add' suggestion for the nth occurrence of a string in the document. */
const suggest = (
  doc: Document,
  surface: string,
  tag: string,
  n = 1,
  extra: Partial<Suggestion> = {},
): Suggestion => {
  const nodes = collectTextNodes(doc, 'ignore');
  let seen = 0;
  for (const { node, search } of nodes) {
    let from = 0;
    while (true) {
      const idx = search.text.indexOf(surface, from);
      if (idx === -1) break;
      if (++seen === n) {
        const rawStart = search.map[idx]!;
        const rawEnd = search.map[idx + surface.length - 1]! + 1;
        return {
          id: `sug_${surface}_${n}`,
          source: 'dictionary',
          action: 'add',
          tag,
          anchor: createAnchor('doc', doc, node, rawStart, rawEnd, 'ignore'),
          status: 'pending',
          ...extra,
        };
      }
      from = idx + 1;
    }
  }
  throw new Error(`occurrence ${n} of ${surface} not found`);
};

describe('applySuggestions', () => {
  it('wraps the anchored range in a new element in the document namespace', async () => {
    const doc = parse(TEI);
    const batch = [suggest(doc, '上陽子', 'persName')];
    const { results, applied } = await applySuggestions(doc, batch, { policy: 'ignore' });

    expect(applied).toBe(1);
    const el = results[0]!.element!;
    expect(el.nodeName).toBe('persName');
    expect(el.namespaceURI).toBe('http://www.tei-c.org/ns/1.0');
    expect(el.textContent).toBe('上陽子');
    expect(serialize(doc)).toContain('<persName>上陽子</persName>曰');
    expect(batch[0]!.status).toBe('accepted');
  });

  it('sets attributes and applies multiple suggestions in the same text node', async () => {
    const doc = parse(TEI);
    const batch = [
      suggest(doc, '上陽子', 'persName', 1, { attributes: { key: 'p001' } }),
      suggest(doc, '老君', 'persName'),
      suggest(doc, '大浮黎土', 'placeName'),
    ];
    const { applied } = await applySuggestions(doc, batch, { policy: 'ignore' });

    expect(applied).toBe(3);
    const xml = serialize(doc);
    expect(xml).toContain('<persName key="p001">上陽子</persName>');
    expect(xml).toContain('<persName>老君</persName>');
    expect(xml).toContain('<placeName>大浮黎土</placeName>');
  });

  it('prefers the longer span when suggestions overlap', async () => {
    const doc = parse(TEI);
    const batch = [
      suggest(doc, '浮黎', 'placeName'),
      suggest(doc, '大浮黎土', 'placeName'),
    ];
    const { results } = await applySuggestions(doc, batch, { policy: 'ignore' });

    const byId = (id: string) => results.find((r) => r.suggestion.id === id)!;
    expect(byId('sug_大浮黎土_1').outcome).toBe('applied');
    // the shorter overlapping span now sits inside the new placeName → dedup catches it
    expect(byId('sug_浮黎_1').outcome).toBe('already-tagged');
    expect(serialize(doc)).not.toContain('<placeName>浮黎</placeName>');
  });

  it('skips text already wrapped in the same tag', async () => {
    const doc = parse(TEI);
    const { results } = await applySuggestions(doc, [suggest(doc, '洛陽', 'placeName')], {
      policy: 'ignore',
    });
    expect(results[0]!.outcome).toBe('already-tagged');
  });

  it('applies only one of two same-span adds with different tags (alternatives)', async () => {
    const doc = parse(TEI);
    const batch = [
      suggest(doc, '上陽子', 'persName', 1, { id: 'alt_pers' }),
      suggest(doc, '上陽子', 'title', 1, { id: 'alt_title' }),
    ];
    const { results, applied } = await applySuggestions(doc, batch, { policy: 'ignore' });

    expect(applied).toBe(1);
    const byId = (id: string) => results.find((r) => r.suggestion.id === id)!;
    expect(byId('alt_pers').outcome).toBe('applied');
    expect(byId('alt_title').outcome).toBe('conflict');
    const xml = serialize(doc);
    expect(xml).toContain('<persName>上陽子</persName>');
    expect(xml).not.toContain('<title>');
  });

  it('blocks insertions the schema forbids', async () => {
    const doc = parse(TEI);
    const { results } = await applySuggestions(doc, [suggest(doc, '上陽子', 'persName')], {
      policy: 'ignore',
      canContain: (parent, child) => !(parent === 'p' && child === 'persName'),
    });
    expect(results[0]!.outcome).toBe('schema-blocked');
    expect(serialize(doc)).not.toContain('<persName>');
  });

  it('blocks insertions matching a user rule', async () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><p><placeName>洛陽之南</placeName></p></TEI>',
    );
    const { results } = await applySuggestions(doc, [suggest(doc, '南', 'date')], {
      policy: 'ignore',
      userRules: [{ tag: 'date', notInside: 'placeName' }],
    });
    expect(results[0]!.outcome).toBe('rule-blocked');
  });

  it('blocks entity tags inside <date>', async () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><date>義熙元年洛陽</date></p></body></text></TEI>',
    );
    const { results } = await applySuggestions(doc, [suggest(doc, '洛陽', 'placeName')], {
      policy: 'ignore',
    });
    expect(results[0]!.outcome).toBe('rule-blocked');
    expect(serialize(doc)).not.toContain('<placeName>');
  });

  it('marks suggestions whose anchor no longer resolves as unresolvable', async () => {
    const doc = parse(TEI);
    const batch = [suggest(doc, '老君', 'persName')];
    // the text changes out from under the suggestion
    const node = collectTextNodes(doc, 'ignore')[0]!.node;
    node.data = node.data.replace('老君', '老子');

    const { results } = await applySuggestions(doc, batch, { policy: 'ignore' });
    expect(results[0]!.outcome).toBe('unresolvable');
    expect(batch[0]!.status).toBe('unresolvable');
  });

  it('reverts the whole batch via the snapshot', async () => {
    const doc = parse(TEI);
    const before = serialize(doc);
    const { snapshot, applied } = await applySuggestions(
      doc,
      [suggest(doc, '上陽子', 'persName'), suggest(doc, '大浮黎土', 'placeName')],
      { policy: 'ignore' },
    );
    expect(applied).toBe(2);
    expect(serialize(doc)).not.toBe(before);
    expect(serialize(revertToSnapshot(snapshot))).toBe(before);
  });

  it('removes an existing tag wrapper (audit remove)', async () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><persName>張衡</persName>是天文學家</p></body></text></TEI>',
    );
    const batch: Suggestion[] = [
      {
        ...suggest(doc, '張衡', 'persName'),
        action: 'remove',
        source: 'ai',
      },
    ];
    const { results, applied } = await applySuggestions(doc, batch, { policy: 'ignore' });
    expect(applied).toBe(1);
    expect(results[0]!.outcome).toBe('applied');
    expect(serialize(doc)).toContain('張衡是天文學家');
    expect(serialize(doc)).not.toContain('<persName>');
  });

  it('retags an existing mention (audit retag)', async () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><persName>洛陽</persName></p></body></text></TEI>',
    );
    const batch: Suggestion[] = [
      {
        ...suggest(doc, '洛陽', 'placeName'),
        action: 'retag',
        source: 'ai',
      },
    ];
    const { results, applied } = await applySuggestions(doc, batch, { policy: 'ignore' });
    expect(applied).toBe(1);
    expect(results[0]!.outcome).toBe('applied');
    expect(serialize(doc)).toContain('<placeName>洛陽</placeName>');
    expect(serialize(doc)).not.toContain('<persName>');
  });

  it('redraws a tag boundary (audit redraw-boundary)', async () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><persName>張衡與</persName>友人</p></body></text></TEI>',
    );
    const batch: Suggestion[] = [
      {
        ...suggest(doc, '張衡', 'persName'),
        action: 'redraw-boundary',
        source: 'ai',
      },
    ];
    const { results, applied } = await applySuggestions(doc, batch, { policy: 'ignore' });
    expect(applied).toBe(1);
    expect(results[0]!.outcome).toBe('applied');
    const xml = serialize(doc);
    expect(xml).toContain('<persName>張衡</persName>與');
    expect(xml).not.toContain('<persName>張衡與</persName>');
  });

  it('processes audit actions before adds in the same batch', async () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><persName>假人</persName>與張衡</p></body></text></TEI>',
    );
    const batch: Suggestion[] = [
      suggest(doc, '張衡', 'persName'),
      { ...suggest(doc, '假人', 'persName'), action: 'remove', source: 'ai' },
    ];
    const { results, applied } = await applySuggestions(doc, batch, { policy: 'ignore' });
    expect(applied).toBe(2);
    const xml = serialize(doc);
    expect(xml).not.toMatch(/<persName>假人<\/persName>/);
    expect(xml).toContain('<persName>張衡</persName>');
    expect(results.filter((r) => r.outcome === 'applied')).toHaveLength(2);
  });

  it('applies resolve-date when displaySurface spans child elements but anchor is first child', async () => {
    const doc = parse(
      '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><date cert="low"><dyn>魏</dyn><era>文帝黃初</era><year>二年</year></date></p></body></text></TEI>',
    );
    const dateEl = doc.getElementsByTagName('date')[0] as Element;
    const anchor = anchorForDateElement(dateEl, findTeiBodyRoot(doc), 'ignore');
    expect(anchor?.surface).toBe('魏');

    const suggestion: Suggestion = {
      id: 'date_resolve_0',
      source: 'dates',
      sourceDetail: 'sanmiao-resolve',
      action: 'resolve-date',
      tag: 'date',
      anchor: anchor!,
      status: 'pending',
      attributes: { resp: '#ljb-sanmiao', cert: 'high', when: '221-08-05' },
      dateResolution: {
        status: 'unique',
        displaySurface: '魏文帝黃初二年',
        candidates: [{ displayLine: 'test', attrs: { when: '221-08-05' } }],
      },
    };

    const { results, applied } = await applySuggestions(doc, [suggestion], { policy: 'ignore' });
    expect(applied).toBe(1);
    expect(results[0]!.outcome).toBe('applied');
    expect(dateEl.getAttribute('when')).toBe('221-08-05');
  });
});

describe('real corpus batch', () => {
  const xmlPath = path.resolve(__dirname, '../../../../test_project/sizhu_shang.xml');
  const maybe = fs.existsSync(xmlPath) ? it : it.skip;

  maybe('tags every untagged 老君, respects tagged 上陽子, and reverts cleanly', async () => {
    const doc = parse(fs.readFileSync(xmlPath, 'utf-8'));
    const before = serialize(doc);

    // one suggestion per document-wide occurrence of each name
    const batch: Suggestion[] = [];
    for (const surface of ['上陽子', '老君']) {
      const total = collectTextNodes(doc, 'ignore').reduce((count, { search }) => {
        let from = 0;
        while ((from = search.text.indexOf(surface, from) + 1) > 0) count++;
        return count;
      }, 0);
      for (let n = 1; n <= total; n++) batch.push(suggest(doc, surface, 'persName', n));
    }
    expect(batch.length).toBeGreaterThan(5);

    const { results, applied, snapshot } = await applySuggestions(doc, batch, { policy: 'ignore' });
    const already = results.filter((r) => r.outcome === 'already-tagged').length;
    expect(applied + already).toBe(batch.length); // nothing unresolvable or blocked
    expect(applied).toBeGreaterThan(0); // untagged occurrences exist and got tagged
    expect(already).toBeGreaterThan(0); // existing <persName>上陽子</persName> respected

    expect(serialize(revertToSnapshot(snapshot))).toBe(before);
  });
});
