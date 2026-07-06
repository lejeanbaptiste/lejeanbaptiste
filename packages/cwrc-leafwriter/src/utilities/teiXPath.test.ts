import { getTeiXPathAtOffset, parseTeiXPathToBreadcrumbSegments } from './teiXPath';

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

describe('getTeiXPathAtOffset', () => {
  test('returns indexed path for text in third item', () => {
    const offset = sample.indexOf('Third');
    const xpath = getTeiXPathAtOffset(sample, offset);
    expect(xpath).toBe('/TEI/text/body/cb:div/list/item[3]');
  });

  test('returns path for first item without sibling index', () => {
    const offset = sample.indexOf('First');
    const xpath = getTeiXPathAtOffset(sample, offset);
    expect(xpath).toBe('/TEI/text/body/cb:div/list/item');
  });
});

describe('parseTeiXPathToBreadcrumbSegments', () => {
  test('builds cumulative xpath prefixes for each segment', () => {
    const segments = parseTeiXPathToBreadcrumbSegments('/TEI/text/body/div/p[4]/date');
    expect(segments).toEqual([
      { label: 'TEI', xpath: '/TEI' },
      { label: 'text', xpath: '/TEI/text' },
      { label: 'body', xpath: '/TEI/text/body' },
      { label: 'div', xpath: '/TEI/text/body/div' },
      { label: 'p[4]', xpath: '/TEI/text/body/div/p[4]' },
      { label: 'date', xpath: '/TEI/text/body/div/p[4]/date' },
    ]);
  });
});
