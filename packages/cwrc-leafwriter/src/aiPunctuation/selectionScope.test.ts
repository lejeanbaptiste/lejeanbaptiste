import {
  filterSegmentsForAi,
  filterSegmentsForAiGaps,
  chunkHanText,
  findSelectionHanRange,
  clipSegmentToHanRange,
  buildJuanHanTape,
  selectionHanOnly,
  segmentNeedsAiGap,
  punctPer100Han,
} from './selectionScope';

describe('chunkHanText', () => {
  it('returns one chunk for short text', () => {
    expect(chunkHanText('甲乙丙')).toEqual([{ text: '甲乙丙', offset: 0 }]);
  });

  it('splits long text with overlap', () => {
    const han = '甲'.repeat(600);
    const chunks = chunkHanText(han, 500, 50);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.offset).toBe(0);
  });
});

describe('filterSegmentsForAi', () => {
  const segments = [
    { id: 0, han: '甲'.repeat(25), has_punct: false },
    { id: 1, han: '乙'.repeat(25), has_punct: true },
    { id: 2, han: '丙', has_punct: false },
  ];

  it('skips punctuated and short segments', () => {
    const out = filterSegmentsForAi(segments);
    expect(out.map((s) => s.id)).toEqual([0]);
  });

  it('filters by segment id scope', () => {
    const out = filterSegmentsForAi(segments, [0, 2]);
    expect(out.map((s) => s.id)).toEqual([0]);
  });
});

describe('filterSegmentsForAiGaps', () => {
  const segments = [
    { id: 0, han: '甲'.repeat(25), has_punct: false },
    { id: 1, han: `${'乙'.repeat(200)}。`, has_punct: true },
    { id: 2, han: `${'丙'.repeat(200)}${'。'.repeat(3)}`, has_punct: true },
    { id: 3, han: '丁', has_punct: false },
  ];

  it('includes unpunctuated segments and sparse parallel coverage', () => {
    const out = filterSegmentsForAiGaps(segments);
    expect(out.map((s) => s.id)).toEqual([0, 1]);
  });

  it('skips segments above punct-density threshold', () => {
    expect(punctPer100Han(segments[2].han)).toBeGreaterThan(0.75);
    expect(segmentNeedsAiGap(segments[2])).toBe(false);
  });
});

describe('findSelectionHanRange', () => {
  const segments = [
    { id: 0, han: '甲乙丙丁', han_start: 0, han_end: 4, has_punct: false },
    { id: 1, han: '戊己庚辛', han_start: 4, han_end: 8, has_punct: false },
  ];

  it('returns undefined when nothing selected', () => {
    expect(findSelectionHanRange(segments, '')).toBeUndefined();
  });

  it('locates a substring within one segment', () => {
    expect(findSelectionHanRange(segments, '乙丙')).toEqual({ start: 1, end: 3 });
  });

  it('clips a segment to the selection range', () => {
    const range = findSelectionHanRange(segments, '乙丙');
    expect(range).toEqual({ start: 1, end: 3 });
    if (!range) throw new Error('expected range');
    const clipped = clipSegmentToHanRange(segments[0], range);
    expect(clipped?.han).toBe('乙丙');
    expect(clipped?.han_start).toBe(1);
    expect(clipped?.han_end).toBe(3);
  });

  it('builds a contiguous han tape', () => {
    expect(buildJuanHanTape(segments)).toBe('甲乙丙丁戊己庚辛');
  });

  it('strips non-Han from selection', () => {
    expect(selectionHanOnly('甲，乙。丙')).toBe('甲乙丙');
  });
});
