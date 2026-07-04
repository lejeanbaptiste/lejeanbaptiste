import { MultiStringMatcher } from './matcher';

const scan = (patterns: string[], text: string) =>
  [...new MultiStringMatcher(patterns).scan(text)];

describe('MultiStringMatcher', () => {
  it('finds all non-overlapping occurrences in one pass', () => {
    const matches = scan(['張衡', '洛陽'], '張衡居洛陽，張衡造渾天儀。');
    expect(matches.map((m) => `${m.pattern}@${m.start}`)).toEqual(['張衡@0', '洛陽@3', '張衡@6']);
  });

  it('is leftmost-longest: the longer pattern wins a shared start', () => {
    const matches = scan(['大浮黎土', '浮黎'], '大浮黎土之中，浮黎再現。');
    // 大浮黎土 claims [0,4); the standalone 浮黎 later still matches
    expect(matches.map((m) => `${m.pattern}@${m.start}`)).toEqual(['大浮黎土@0', '浮黎@7']);
  });

  it('resumes after a match (no overlapping hits)', () => {
    // 'aa' in 'aaa' matches once at 0, then position 2 has no full 'aa'
    expect(scan(['aa'], 'aaa').map((m) => m.start)).toEqual([0]);
  });

  it('dedupes patterns and reports size; ignores empty', () => {
    const matcher = new MultiStringMatcher(['a', 'a', 'bb', '']);
    expect(matcher.size).toBe(2);
  });

  it('handles many distinct lengths', () => {
    const matches = scan(['a', 'bbb', 'cc'], 'xbbbaccz');
    expect(matches.map((m) => `${m.pattern}@${m.start}`)).toEqual(['bbb@1', 'a@4', 'cc@5']);
  });

  it('returns nothing for an empty matcher or empty text', () => {
    expect(scan([], 'abc')).toEqual([]);
    expect(scan(['a'], '')).toEqual([]);
  });
});
