import { findElementOpenTagInXml } from './findElementOpenTagInXml';

const sampleXml = `<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text>
    <body>
      <p>First</p>
      <p>Second</p>
    </body>
  </text>
</TEI>`;

describe('findElementOpenTagInXml', () => {
  test('finds the second paragraph opening tag', () => {
    const position = findElementOpenTagInXml(sampleXml, '/TEI/text/body/p[2]');
    expect(position).not.toBeNull();
    expect(sampleXml.slice(position!.start, position!.end)).toMatch(/^<p[\s>/]/);
  });

  test('returns null for missing path', () => {
    expect(findElementOpenTagInXml(sampleXml, '/TEI/text/body/seg[9]')).toBeNull();
  });
});
