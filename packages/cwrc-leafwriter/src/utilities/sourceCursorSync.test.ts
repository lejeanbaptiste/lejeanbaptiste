import { getTeiXPathAtOffset } from './teiXPath';
import {
  findElementOpenTagStartInXml,
  findTextOffsetInXml,
  mapVisualCaretToSourceOffset,
} from './sourceCursorSync';

const sample = `<?xml version="1.0"?>
<TEI>
  <text>
    <body>
      <cb:div>
        <list>
          <item>First</item>
          <item>Second</item>
          <item>Third</item>
        </list>
      </cb:div>
    </body>
  </text>
</TEI>`;

describe('findTextOffsetInXml', () => {
  test('maps start of third item text', () => {
    const xpath = '/TEI/text/body/cb:div/list/item[3]';
    const expected = sample.indexOf('Third');
    expect(findTextOffsetInXml(sample, xpath, 0)).toBe(expected);
  });

  test('maps offset within third item text', () => {
    const xpath = '/TEI/text/body/cb:div/list/item[3]';
    const start = sample.indexOf('Third');
    expect(findTextOffsetInXml(sample, xpath, 2)).toBe(start + 2);
  });

  test('maps first item without sibling index in xpath', () => {
    const xpath = '/TEI/text/body/cb:div/list/item';
    expect(findTextOffsetInXml(sample, xpath, 0)).toBe(sample.indexOf('First'));
  });

  test('returns null for unknown xpath', () => {
    expect(findTextOffsetInXml(sample, '/TEI/text/body/missing', 0)).toBeNull();
  });
});

describe('findElementOpenTagStartInXml', () => {
  test('finds opening tag for indexed item', () => {
    const xpath = '/TEI/text/body/cb:div/list/item[3]';
    const start = findElementOpenTagStartInXml(sample, xpath);
    expect(start).not.toBeNull();
    expect(sample.slice(start!, start! + 6)).toBe('<item>');
  });
});

describe('mapVisualCaretToSourceOffset', () => {
  test('round-trips xpath at offset via getTeiXPathAtOffset', () => {
    const sourceOffset = sample.indexOf('Second') + 3;
    const xpath = getTeiXPathAtOffset(sample, sourceOffset);
    expect(xpath).not.toBeNull();

    const mapped = mapVisualCaretToSourceOffset(sample, {
      teiXPath: xpath!,
      offsetInElementText: 3,
    });
    expect(mapped).toBe(sourceOffset);
  });
});
