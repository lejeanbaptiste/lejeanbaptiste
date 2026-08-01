import {
  emptyExclusions,
  exclusionsHaveContent,
  filterSuggestionsByExclusions,
  linesToSurfaces,
  nestingPathsToUserRules,
  parseNestingPath,
  surfacesToLines,
} from './autoTaggingExclusions';
import type { Suggestion } from './types';

describe('autoTaggingExclusions', () => {
  it('parses //ancestor//child nesting paths', () => {
    expect(parseNestingPath('//persName//title')).toEqual({
      notInside: 'persName',
      tag: 'title',
    });
    expect(parseNestingPath('  //placeName//title  ')).toEqual({
      notInside: 'placeName',
      tag: 'title',
    });
    expect(parseNestingPath('not a path')).toBeNull();
    expect(parseNestingPath('# comment')).toBeNull();
  });

  it('dedupes nesting rules', () => {
    expect(
      nestingPathsToUserRules(['//persName//title', '//persName//title', '//placeName//title']),
    ).toEqual([
      { notInside: 'persName', tag: 'title' },
      { notInside: 'placeName', tag: 'title' },
    ]);
  });

  it('filters suggestions by exact surface+tag', () => {
    const suggestions = [
      {
        tag: 'placeName',
        anchor: { surface: '將軍', xpath: '', offset: 0 },
      },
      {
        tag: 'placeName',
        anchor: { surface: '洛陽', xpath: '', offset: 0 },
      },
      {
        tag: 'persName',
        anchor: { surface: '將軍', xpath: '', offset: 0 },
      },
    ] as Suggestion[];
    const kept = filterSuggestionsByExclusions(suggestions, {
      nestingPaths: [],
      surfacesByTag: { placeName: ['將軍'] },
    });
    expect(kept.map((s) => `${s.tag}:${s.anchor.surface}`)).toEqual([
      'placeName:洛陽',
      'persName:將軍',
    ]);
  });

  it('round-trips surface lines', () => {
    expect(linesToSurfaces('將軍\n\n# skip\n洛陽\n將軍')).toEqual(['將軍', '洛陽']);
    expect(surfacesToLines(['將軍', '洛陽'])).toBe('將軍\n洛陽');
  });

  it('reports whether exclusions have content', () => {
    expect(exclusionsHaveContent(emptyExclusions())).toBe(false);
    expect(exclusionsHaveContent({ nestingPaths: ['//a//b'], surfacesByTag: {} })).toBe(true);
    expect(
      exclusionsHaveContent({ nestingPaths: [], surfacesByTag: { placeName: ['將軍'] } }),
    ).toBe(true);
  });
});
