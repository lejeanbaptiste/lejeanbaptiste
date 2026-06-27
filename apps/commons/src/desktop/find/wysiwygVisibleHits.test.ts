import { filterHitsForWysiwygEditor, isHitVisibleInWysiwygEditor } from './wysiwygVisibleHits';

const sample = `<?xml version="1.0"?>
<TEI>
  <teiHeader>
    <fileDesc><title>Hidden title</title></fileDesc>
  </teiHeader>
  <text>
    <body>
      <p>Visible word here</p>
    </body>
  </text>
</TEI>`;

describe('wysiwygVisibleHits', () => {
  test('excludes hits inside teiHeader', () => {
    const hiddenStart = sample.indexOf('Hidden');
    const hiddenEnd = hiddenStart + 'Hidden'.length;
    expect(isHitVisibleInWysiwygEditor(sample, hiddenStart, hiddenEnd)).toBe(false);
  });

  test('includes hits in body text', () => {
    const visibleStart = sample.indexOf('Visible');
    const visibleEnd = visibleStart + 'Visible'.length;
    expect(isHitVisibleInWysiwygEditor(sample, visibleStart, visibleEnd)).toBe(true);
  });

  test('reindexes filtered hits', () => {
    const hiddenStart = sample.indexOf('Hidden');
    const visibleStart = sample.indexOf('Visible');
    const filtered = filterHitsForWysiwygEditor(sample, [
      {
        matchIndex: 0,
        start: hiddenStart,
        end: hiddenStart + 6,
        line: 1,
        column: 1,
        snippet: { prefix: '', match: 'Hidden', suffix: '' },
      },
      {
        matchIndex: 1,
        start: visibleStart,
        end: visibleStart + 7,
        line: 1,
        column: 1,
        snippet: { prefix: '', match: 'Visible', suffix: '' },
      },
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].matchIndex).toBe(0);
    expect(filtered[0].start).toBe(visibleStart);
  });
});
