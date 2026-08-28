import { describe, expect, it } from 'vitest';
import {
  ctextChapterUrlFromIndex,
  fetchWikisourceParallel,
  htmlToParallelText,
  isCtextWikiResUrl,
  isCtextWikiUrl,
  isWikisourceUrl,
  parseWikisourceUrl,
} from './parallelUrlFetch';

describe('parseWikisourceUrl', () => {
  it('parses zh.wikisource wiki paths', () => {
    expect(parseWikisourceUrl('https://zh.wikisource.org/wiki/%E8%AB%96%E8%AA%9E')).toEqual({
      apiHost: 'zh.wikisource.org',
      title: '論語',
    });
  });

  it('parses zh-hant variant paths', () => {
    expect(parseWikisourceUrl('https://zh.wikisource.org/zh-hant/%E8%8D%80%E5%AD%90')).toEqual({
      apiHost: 'zh.wikisource.org',
      title: '荀子',
    });
  });

  it('rejects non-wikisource hosts', () => {
    expect(parseWikisourceUrl('https://ctext.org/wiki.pl?chapter=1')).toBeNull();
  });
});

describe('url kind detectors', () => {
  it('detects ctext wiki URLs', () => {
    expect(isCtextWikiUrl('https://ctext.org/wiki.pl?if=gb&chapter=793335')).toBe(true);
    expect(isCtextWikiUrl('https://ctext.org/wiki.pl?if=gb&res=150222')).toBe(true);
    expect(isCtextWikiResUrl('https://ctext.org/wiki.pl?if=gb&res=150222')).toBe(true);
    expect(isCtextWikiResUrl('https://ctext.org/wiki.pl?if=gb&chapter=793335')).toBe(false);
    expect(isCtextWikiUrl('https://ctext.org/analects')).toBe(false);
  });

  it('builds chapter URLs from res index URLs', () => {
    expect(
      ctextChapterUrlFromIndex('https://ctext.org/wiki.pl?if=gb&res=150222', '793335'),
    ).toBe('https://ctext.org/wiki.pl?if=gb&chapter=793335');
  });

  it('detects wikisource URLs', () => {
    expect(isWikisourceUrl('https://en.wikisource.org/wiki/Foo')).toBe(true);
  });
});

describe('htmlToParallelText', () => {
  it('keeps Han and punctuation, drops tags', () => {
    const html = '<div class="mw-parser-output"><p>子曰：「學而時習之。</p></div>';
    expect(htmlToParallelText(html)).toContain('子曰');
    expect(htmlToParallelText(html)).not.toContain('<p>');
  });
});

describe('fetchWikisourceParallel', () => {
  it('maps API HTML to plain text', async () => {
    const fetchImpl = async () =>
      ({
        ok: true,
        json: async () => ({
          parse: {
            title: '論語',
            text: { '*': '<div class="mw-parser-output"><p>子曰：「學而時習之，不亦說乎？」</p></div>' },
          },
        }),
      }) as Response;

    const result = await fetchWikisourceParallel('https://zh.wikisource.org/wiki/論語', fetchImpl);
    expect(result.kind).toBe('wikisource');
    expect(result.text).toContain('子曰');
    expect(result.label).toContain('論語');
  });

  it('surfaces API errors', async () => {
    const fetchImpl = async () =>
      ({
        ok: true,
        json: async () => ({ error: { code: 'missingtitle', info: 'The page you specified does not exist.' } }),
      }) as Response;

    await expect(fetchWikisourceParallel('https://zh.wikisource.org/wiki/Missing', fetchImpl)).rejects.toThrow(
      /does not exist/,
    );
  });
});
