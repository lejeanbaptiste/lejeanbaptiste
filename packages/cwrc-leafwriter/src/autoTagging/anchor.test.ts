import fs from 'fs';
import path from 'path';
import {
  collectTextNodes,
  compareAnchorsByDocumentPosition,
  compareXPath,
  createAnchor,
  resolveAnchor,
  resolveXPath,
  xpathForTextNode,
} from './anchor';
import { buildSearchText, hashText, normalizeDomText } from './normalize';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const TEI = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text>
    <body>
      <div>
        <p>上陽子曰：太上洞玄。</p>
        <p>又見上陽子，
          上陽子再曰。</p>
        <p>New York is not <placeName>York</placeName>.</p>
      </div>
    </body>
  </text>
</TEI>`;

const nthTextNode = (doc: Document, containing: string): Text => {
  const nodes = collectTextNodes(doc, 'ignore');
  const found = nodes.find((n) => n.node.data.includes(containing));
  if (!found) throw new Error(`no text node containing ${containing}`);
  return found.node;
};

describe('buildSearchText', () => {
  it('strips whitespace under the ignore policy, mapping back to raw offsets', () => {
    const { text, map } = buildSearchText('又見上陽子，\n          上陽子再曰。', 'ignore');
    expect(text).toBe('又見上陽子，上陽子再曰。');
    expect(map[6]).toBe(17); // first 上 after the line break maps past the indentation
  });

  it('collapses whitespace runs to one space under the collapse policy', () => {
    const { text, map } = buildSearchText('  New\n  York  is', 'collapse');
    expect(text).toBe('New York is');
    expect(map[0]).toBe(2);
    expect(map[4]).toBe(8); // Y
  });

  it('is stable for text without whitespace', () => {
    const { text, map } = buildSearchText('abc', 'ignore');
    expect(text).toBe('abc');
    expect(map).toEqual([0, 1, 2]);
  });
});

describe('hashText', () => {
  it('is deterministic and sensitive to changes', () => {
    expect(hashText('上陽子')).toBe(hashText('上陽子'));
    expect(hashText('上陽子')).not.toBe(hashText('上陽孑'));
  });
});

describe('xpath round-trip', () => {
  it('resolves the path generated for a text node back to the same node', () => {
    const doc = parse(TEI);
    const node = nthTextNode(doc, '又見');
    const xpath = xpathForTextNode(node);
    expect(xpath).toBe('/TEI/text/body/div/p[2]/text()[1]');
    expect(resolveXPath(doc, xpath)).toBe(node);
  });

  it('returns null for paths that no longer exist', () => {
    const doc = parse(TEI);
    expect(resolveXPath(doc, '/TEI/text/body/div/p[9]/text()[1]')).toBeNull();
  });
});

describe('createAnchor / resolveAnchor', () => {
  it('tier 1: resolves an anchor in an unchanged document at the exact offset', () => {
    const doc = parse(TEI);
    const node = nthTextNode(doc, '上陽子曰');
    const anchor = createAnchor('doc1', doc, node, 0, 3, 'ignore');

    expect(anchor.surface).toBe('上陽子');
    expect(anchor.occurrence).toBe(1);

    const resolved = resolveAnchor(doc, anchor, 'ignore');
    expect(resolved).not.toBeNull();
    expect(resolved!.tier).toBe(1);
    expect(resolved!.node).toBe(node);
    expect(resolved!.node.data.slice(resolved!.start, resolved!.end)).toBe('上陽子');
  });

  it('counts occurrences across the whole document, whitespace ignored', () => {
    const doc = parse(TEI);
    const node = nthTextNode(doc, '又見');
    // third 上陽子 in the document: the one after the line break
    const raw = node.data;
    const start = raw.indexOf('上陽子', raw.indexOf('，'));
    const anchor = createAnchor('doc1', doc, node, start, start + 3, 'ignore');
    expect(anchor.occurrence).toBe(3);
  });

  it('tier 2: re-locates within an edited node using context', () => {
    const doc = parse(TEI);
    const node = nthTextNode(doc, '又見');
    const raw = node.data;
    const start = raw.indexOf('上陽子', raw.indexOf('，'));
    const anchor = createAnchor('doc1', doc, node, start, start + 3, 'ignore');

    node.data = `序言。${node.data}`; // edit shifts offsets and changes the hash

    const resolved = resolveAnchor(doc, anchor, 'ignore');
    expect(resolved).not.toBeNull();
    expect(resolved!.tier).toBe(2);
    expect(resolved!.node.data.slice(resolved!.start, resolved!.end)).toBe('上陽子');
    // it found the occurrence before 再曰, not the one after 又見
    expect(resolved!.node.data.slice(resolved!.end, resolved!.end + 2)).toBe('再曰');
  });

  it('tier 3: re-locates after structural change breaks the xpath', () => {
    const doc = parse(TEI);
    const node = nthTextNode(doc, '又見');
    const raw = node.data;
    const start = raw.indexOf('上陽子', raw.indexOf('，'));
    const anchor = createAnchor('doc1', doc, node, start, start + 3, 'ignore');

    // insert a new first <p>, shifting sibling indexes so the xpath resolves to the wrong node
    const div = node.parentElement!.parentElement!;
    const newP = doc.createElementNS(div.namespaceURI, 'p');
    newP.textContent = '新序。';
    div.insertBefore(newP, div.firstElementChild);

    const resolved = resolveAnchor(doc, anchor, 'ignore');
    expect(resolved).not.toBeNull();
    expect(resolved!.node).toBe(node);
    expect(resolved!.node.data.slice(resolved!.end, resolved!.end + 2)).toBe('再曰');
  });

  it('returns null when the surface no longer exists anywhere', () => {
    const doc = parse(TEI);
    const node = nthTextNode(doc, '上陽子曰');
    const anchor = createAnchor('doc1', doc, node, 0, 3, 'ignore');

    for (const { node: n } of collectTextNodes(doc, 'ignore')) {
      n.data = n.data.replace(/上陽子/g, '某人');
    }

    expect(resolveAnchor(doc, anchor, 'ignore')).toBeNull();
  });

  it('refuses to guess between ambiguous candidates with no matching context', () => {
    const doc = parse('<TEI><text><body><p>甲乙丙。甲乙丙。</p></body></text></TEI>');
    const node = nthTextNode(doc, '甲乙丙');
    const anchor = createAnchor('doc1', doc, node, 0, 3, 'ignore');

    // destroy both contexts and the occurrence structure
    node.data = '000甲乙丙111甲乙丙222';
    const resolved = resolveAnchor(doc, anchor, 'ignore');
    // occurrence 1 exists but its context no longer matches; both candidates score 0
    expect(resolved).toBeNull();
  });

  it('handles collapse-policy anchors across line breaks', () => {
    const doc = parse('<TEI><p>the City of\n      New York is large</p></TEI>');
    const node = nthTextNode(doc, 'New York');
    const raw = node.data;
    const start = raw.indexOf('New');
    const anchor = createAnchor('doc1', doc, node, start, start + 8, 'collapse');
    expect(anchor.surface).toBe('New York');

    const resolved = resolveAnchor(doc, anchor, 'collapse');
    expect(resolved).not.toBeNull();
    expect(node.data.slice(resolved!.start, resolved!.end)).toBe('New York');
  });
});

describe('real corpus (test_project/sizhu_shang.xml)', () => {
  const xmlPath = path.resolve(__dirname, '../../../../test_project/sizhu_shang.xml');
  const available = fs.existsSync(xmlPath);
  const maybe = available ? it : it.skip;

  maybe('anchors and re-resolves a repeated name in a real messy document', () => {
    const doc = parse(fs.readFileSync(xmlPath, 'utf-8'));
    const nodes = collectTextNodes(doc, 'ignore');

    // find the second text node whose search text contains 上陽子
    const hits = nodes.filter((n) => n.search.text.includes('上陽子'));
    expect(hits.length).toBeGreaterThan(2);

    const target = hits[1]!;
    const searchIndex = target.search.text.indexOf('上陽子');
    const rawStart = target.search.map[searchIndex]!;
    const anchor = createAnchor('sizhu', doc, target.node, rawStart, rawStart + 3, 'ignore');
    expect(anchor.surface).toBe('上陽子');
    expect(anchor.occurrence).toBeGreaterThan(1);

    const resolved = resolveAnchor(doc, anchor, 'ignore');
    expect(resolved).not.toBeNull();
    expect(resolved!.tier).toBe(1);
    expect(resolved!.node).toBe(target.node);

    // simulate an edit earlier in the same node and re-resolve
    target.node.data = `〇${target.node.data}`;
    const reResolved = resolveAnchor(doc, anchor, 'ignore');
    expect(reResolved).not.toBeNull();
    expect(reResolved!.node.data.slice(reResolved!.start, reResolved!.end)).toBe('上陽子');
  });
});

describe('compareXPath', () => {
  it('orders sibling elements by numeric index, not lexicographically', () => {
    expect(compareXPath('/TEI/text/body/div[2]/p/text()[1]', '/TEI/text/body/div[10]/p/text()[1]')).toBeLessThan(
      0,
    );
  });

  it('orders paragraphs within the same div', () => {
    expect(compareXPath('/TEI/text/body/div/p[1]/text()[1]', '/TEI/text/body/div/p[2]/text()[1]')).toBeLessThan(0);
  });

  it('treats a shorter path as an ancestor that comes first', () => {
    expect(compareXPath('/TEI/text/body/div', '/TEI/text/body/div/p/text()[1]')).toBeLessThan(0);
  });
});

describe('compareAnchorsByDocumentPosition', () => {
  it('orders by xpath first, then offset within the text node', () => {
    const earlier = {
      documentId: 'doc',
      xpath: '/TEI/text/body/div/p[1]/text()[1]',
      offset: 0,
      surface: '甲',
      occurrence: 1,
      contextBefore: '',
      contextAfter: '',
      nodeHash: '0',
    };
    const laterParagraph = { ...earlier, xpath: '/TEI/text/body/div/p[2]/text()[1]' };
    const laterOffset = { ...earlier, offset: 5 };
    expect(compareAnchorsByDocumentPosition(earlier, laterParagraph)).toBeLessThan(0);
    expect(compareAnchorsByDocumentPosition(earlier, laterOffset)).toBeLessThan(0);
  });
});
