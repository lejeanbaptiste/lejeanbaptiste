import { findElementOpenTagByIdInXml } from './findElementByIdInXml';

const sampleXml = `<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text>
    <body>
      <div type="text" xml:id="div1">
        <p xml:id="p1">First</p>
        <p xml:id="p2">Second</p>
      </div>
    </body>
  </text>
</TEI>`;

describe('findElementOpenTagByIdInXml', () => {
  it('finds xml:id on an element', () => {
    const position = findElementOpenTagByIdInXml(sampleXml, 'p2');
    expect(position).not.toBeNull();
    expect(sampleXml.slice(position!.start, position!.end)).toBe('<p xml:id="p2">');
  });

  it('returns null when id is missing', () => {
    expect(findElementOpenTagByIdInXml(sampleXml, 'missing')).toBeNull();
  });
});
