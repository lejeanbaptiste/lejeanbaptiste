import { recognizeNobleTitleFromName } from './nobleTitleNameRecognition';

describe('recognizeNobleTitleFromName', () => {
  const caoCaoTitle = {
    placeName: '魏',
    roleName: '帝',
    posthumousName: '武',
    dynasty: '魏',
    ref: 'wiki-nt:2203',
  };

  it('recognizes the full-form spelling CBDB uses ("武皇帝") against the canonical short form ("帝")', () => {
    expect(recognizeNobleTitleFromName('武皇帝', [caoCaoTitle])).toEqual({
      placeName: '魏',
      roleName: '帝',
      posthumousName: '武',
      dynasty: '魏',
      ref: 'wiki-nt:2203',
    });
  });

  it('recognizes the exact canonical spelling too ("武帝")', () => {
    expect(recognizeNobleTitleFromName('武帝', [caoCaoTitle])).toEqual(
      expect.objectContaining({ roleName: '帝', posthumousName: '武' }),
    );
  });

  it('does not match an unrelated name (temple name "太祖")', () => {
    expect(recognizeNobleTitleFromName('太祖', [caoCaoTitle])).toBeNull();
  });

  it('does not match the bare person name', () => {
    expect(recognizeNobleTitleFromName('曹操', [caoCaoTitle])).toBeNull();
  });

  it('returns null when the person has no known titles', () => {
    expect(recognizeNobleTitleFromName('武皇帝', [])).toBeNull();
  });

  it('matches DILA\'s fief-prefixed form for Liu Bei ("漢昭烈帝", exact canonical spelling)', () => {
    const liuBeiTitle = {
      placeName: '漢',
      roleName: '帝',
      posthumousName: '昭烈',
      dynasty: '漢',
      ref: 'wiki-nt:1610',
    };
    expect(recognizeNobleTitleFromName('漢昭烈帝', [liuBeiTitle])).toEqual(
      expect.objectContaining({ placeName: '漢', roleName: '帝', posthumousName: '昭烈' }),
    );
  });

  it('matches a fief-prefixed full-form spelling too ("漢昭烈皇帝")', () => {
    const liuBeiTitle = {
      placeName: '漢',
      roleName: '帝',
      posthumousName: '昭烈',
      dynasty: '漢',
      ref: 'wiki-nt:1610',
    };
    expect(recognizeNobleTitleFromName('漢昭烈皇帝', [liuBeiTitle])).toEqual(
      expect.objectContaining({ roleName: '帝', posthumousName: '昭烈' }),
    );
  });
});
