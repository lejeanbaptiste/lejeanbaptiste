import { filterVisualCursorPositions } from './cursorPositionFilter';

describe('filterVisualCursorPositions', () => {
  it('keeps visual positions and drops source-mode positions', () => {
    const filtered = filterVisualCursorPositions({
      '/proj/a.xml': { mode: 'visual', teiXPath: '/TEI/text/body/p', offsetInElementText: 3 },
      '/proj/b.xml': { mode: 'source', offset: 120 },
    });

    expect(filtered).toEqual({
      '/proj/a.xml': { mode: 'visual', teiXPath: '/TEI/text/body/p', offsetInElementText: 3 },
    });
  });
});
