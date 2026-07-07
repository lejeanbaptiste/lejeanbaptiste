import {
  clearWikidataNamesCacheForTests,
  filterReconcileByExactSurface,
  isLatinSurface,
  normalizeMatchString,
  reconcileMatchMatchesSurface,
  stringsMatchExactly,
  wikidataNamesByQid,
} from './disambiguationMatch';

describe('disambiguationMatch', () => {
  afterEach(() => {
    clearWikidataNamesCacheForTests();
  });

  it('matches identical CJK strings exactly', () => {
    expect(stringsMatchExactly('桓玄', '桓玄')).toBe(true);
    expect(stringsMatchExactly('桓玄', '桓玄fan')).toBe(false);
  });

  it('matches Latin strings case-insensitively', () => {
    expect(stringsMatchExactly('Huan Xuan', 'huan xuan')).toBe(true);
    expect(stringsMatchExactly('Huan Xuan', 'Huan Xuanfan')).toBe(false);
  });

  it('detects Latin-only surfaces', () => {
    expect(isLatinSurface('Huan Xuan')).toBe(true);
    expect(isLatinSurface('桓玄')).toBe(false);
  });

  it('accepts reconcile rows when Wikidata carries the surface form', async () => {
    const fetchImpl = async () =>
      ({
        ok: true,
        json: async () => ({
          entities: {
            Q123: {
              labels: { en: { value: 'Huan Xuan' } },
              aliases: { 'zh-hant': [{ value: '桓玄' }] },
            },
            Q999: {
              labels: { en: { value: 'Huan Xuanfan' } },
              aliases: { 'zh-hant': [{ value: '桓玄範' }] },
            },
          },
        }),
      }) as Response;

    const namesByQid = await wikidataNamesByQid(['Q123', 'Q999'], fetchImpl);

    expect(
      reconcileMatchMatchesSurface(
        '桓玄',
        {
          label: 'Huan Xuan',
          uri: 'https://www.wikidata.org/wiki/Q123',
        },
        namesByQid,
      ),
    ).toBe(true);

    expect(
      reconcileMatchMatchesSurface(
        '桓玄',
        {
          label: 'Huan Xuanfan',
          description: 'person, CBDB ID = 380975',
          uri: 'https://www.wikidata.org/wiki/Q999',
        },
        namesByQid,
      ),
    ).toBe(false);
  });

  it('filters a mixed reconcile list by exact surface', async () => {
    const fetchImpl = async () =>
      ({
        ok: true,
        json: async () => ({
          entities: {
            Q123: { aliases: { 'zh-hant': [{ value: '桓玄' }] } },
            Q999: { aliases: { 'zh-hant': [{ value: '桓玄範' }] } },
          },
        }),
      }) as Response;

    const filtered = await filterReconcileByExactSurface(
      [
        {
          label: 'Huan Xuan',
          uri: 'https://www.wikidata.org/wiki/Q123',
        },
        {
          label: 'Huan Xuanfan',
          uri: 'https://www.wikidata.org/wiki/Q999',
          description: 'person, CBDB ID = 380975',
        },
      ],
      '桓玄',
      fetchImpl,
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.label).toBe('Huan Xuan');
    expect(normalizeMatchString(' 桓玄 ')).toBe('桓玄');
  });
});
