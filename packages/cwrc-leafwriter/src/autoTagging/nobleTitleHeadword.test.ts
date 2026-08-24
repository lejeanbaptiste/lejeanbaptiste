import {
  endsWithNobleTitleRank,
  inventedTitleSplitCleanup,
  isNobleTitleHeadword,
  nobleTitleSurfaceVariants,
  personalNameForSegmentation,
  preferredEntityPrimaryName,
} from './nobleTitleHeadword';

describe('nobleTitleHeadword', () => {
  it('rebuilds common title surfaces from structured parts', () => {
    expect(
      nobleTitleSurfaceVariants({
        fief: '海鹽',
        roleName: '公主',
      }),
    ).toContain('海鹽公主');
    expect(
      nobleTitleSurfaceVariants({
        fief: '宋',
        posthumousName: '昭',
        roleName: '太后',
      }),
    ).toContain('宋昭太后');
  });

  it('recognizes multi-character rank suffixes', () => {
    expect(endsWithNobleTitleRank('孝武昭路太后')).toBe(true);
    expect(endsWithNobleTitleRank('海鹽公主')).toBe(true);
    expect(endsWithNobleTitleRank('王安石')).toBe(false);
    expect(endsWithNobleTitleRank('太后')).toBe(false);
  });

  it('matches pack nobleTitles when suffix alone is ambiguous', () => {
    expect(isNobleTitleHeadword('海鹽公主', [{ fief: '海鹽', roleName: '公主' }])).toBe(true);
    expect(isNobleTitleHeadword('王安石')).toBe(false);
  });

  it('refuses segmentation surfaces for title headwords', () => {
    expect(
      personalNameForSegmentation(
        '孝武昭路太后',
        [{ text: '路', type: 'family' }],
        [{ fief: '宋', posthumousName: '昭', roleName: '太后' }],
      ),
    ).toBeNull();
    expect(
      personalNameForSegmentation('王安石', [
        { text: '王', type: 'family' },
        { text: '安石', type: 'given' },
      ]),
    ).toBe('王安石');
  });

  it('prefers pack personal primary / 姓+名 over a title headword', () => {
    expect(
      preferredEntityPrimaryName(
        '海鹽公主',
        [
          { text: '蕭', type: 'family' },
          { text: '氏', type: 'given' },
        ],
        [{ fief: '海鹽', roleName: '公主' }],
      ),
    ).toBe('蕭氏');
    expect(
      preferredEntityPrimaryName(
        '海鹽公主',
        [{ text: '蕭', type: 'family' }],
        [{ fief: '海鹽', roleName: '公主' }],
      ),
    ).toBe('海鹽公主');
    expect(
      preferredEntityPrimaryName('王安石', [
        { text: '王安石', type: 'primary' },
        { text: '王', type: 'family' },
        { text: '安石', type: 'given' },
      ]),
    ).toBe('王安石');
  });

  it('lists invented title-split names for re-backfill cleanup', () => {
    expect(
      inventedTitleSplitCleanup({
        headword: '孝武昭路太后',
        nameEntries: [
          { text: '孝武昭路太后', type: 'primary' },
          { text: '孝', type: 'family' },
          { text: '武昭路太后', type: 'given' },
          { text: '路', type: 'family' },
        ],
        familyName: '孝',
        givenName: '武昭路太后',
        typedNames: [{ text: '路', type: 'family' }],
        nobleTitles: [{ fief: '宋', posthumousName: '昭', roleName: '太后' }],
      }),
    ).toEqual({
      tombstoneTexts: expect.arrayContaining(['孝', '武昭路太后']),
      clearGivenName: true,
      preferredFamily: '路',
    });
  });
});
