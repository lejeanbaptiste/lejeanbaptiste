import { evaluateXPathAll, getXPathForElement, parseXmlDocument } from './evaluateXPathAll';

const sampleXml = `<?xml version="1.0"?>
<TEI>
  <text>
    <body>
      <p>One</p>
      <p>Two</p>
    </body>
  </text>
</TEI>`;

describe('searchXPath raw XML paths', () => {
  test('builds stable TEI xpath strings for matches', () => {
    const doc = parseXmlDocument(sampleXml);
    expect(doc).not.toBeNull();

    const nodes = evaluateXPathAll(doc!, '//p');
    expect(nodes).toHaveLength(2);

    const paths = nodes.map((node) => getXPathForElement(node, doc!));
    expect(paths[0]).toContain('p[');
    expect(paths[1]).toContain('p[');
    expect(paths[0]).not.toBe(paths[1]);
  });
});
