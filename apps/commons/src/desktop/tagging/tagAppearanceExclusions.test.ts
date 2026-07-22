import {
  isTagAppearanceCandidate,
  isTagAppearanceExcluded,
  tagAppearanceSupportsHighlight,
} from './tagAppearanceExclusions';

describe('tagAppearanceExclusions', () => {
  test('excludes header metadata like publisher', () => {
    expect(isTagAppearanceExcluded('publisher')).toBe(true);
    expect(isTagAppearanceExcluded('persName')).toBe(false);
  });

  test('excludes document scaffolding', () => {
    expect(isTagAppearanceExcluded('div')).toBe(true);
    expect(isTagAppearanceExcluded('p')).toBe(true);
    expect(isTagAppearanceExcluded('div3')).toBe(true);
    expect(isTagAppearanceExcluded('list')).toBe(true);
  });

  test('includes body annotation tags when counted', () => {
    expect(isTagAppearanceCandidate('date', 2)).toBe(true);
    expect(isTagAppearanceCandidate('persName', 1)).toBe(true);
    expect(isTagAppearanceCandidate('p', 5)).toBe(false);
    expect(isTagAppearanceCandidate('publisher', 1)).toBe(false);
  });

  test('editorial tags support text colour only', () => {
    expect(tagAppearanceSupportsHighlight('choice')).toBe(false);
    expect(tagAppearanceSupportsHighlight('corr')).toBe(false);
    expect(tagAppearanceSupportsHighlight('date')).toBe(true);
  });
});
