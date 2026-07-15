import {
  clearWikidataNamesCacheForTests,
  clearWikidataTypedNamesCacheForTests,
  fetchWikidataTypedNames,
  filterReconcileByExactSurface,
  isLatinSurface,
  normalizeMatchString,
  preferredLabelForLang,
  reconcileMatchMatchesSurface,
  stringsMatchExactly,
  wikidataLabelsByQid,
  wikidataNamesByQid,
} from './disambiguationMatch';

describe('disambiguationMatch', () => {
  afterEach(() => {
    clearWikidataNamesCacheForTests();
    clearWikidataTypedNamesCacheForTests();
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

  it('returns per-language labels and picks the project-language one with fallbacks', async () => {
    const fetchImpl = (async () =>
      ({
        ok: true,
        json: async () => ({
          entities: {
            Q11332: {
              labels: {
                zh: { value: '张衡' },
                'zh-hant': { value: '張衡' },
                en: { value: 'Zhang Heng' },
              },
            },
          },
        }),
      }) as Response) as typeof fetch;

    const labels = (await wikidataLabelsByQid(['Q11332'], fetchImpl)).get('Q11332')!;
    expect(labels['zh-hant']).toBe('張衡');
    expect(preferredLabelForLang(labels, 'zh-Hant')).toBe('張衡');
    expect(preferredLabelForLang(labels, 'lzh')).toBe('張衡');
    expect(preferredLabelForLang({ zh: '张衡' }, 'zh-Hant')).toBe('张衡');
    expect(preferredLabelForLang(labels, 'bo')).toBeNull();
    expect(preferredLabelForLang(labels, null)).toBeNull();
  });

  it('fetches typed names from Wikidata name-property claims', async () => {
    const claim = (text: string, language = 'zh') => ({
      mainsnak: { datavalue: { value: { text, language } } },
    });
    const fetchImpl = jest.fn(async () =>
      ({
        ok: true,
        json: async () => ({
          entities: {
            Q11332: {
              claims: {
                P1559: [claim('張衡', 'zh-hant')],
                P1782: [claim('平子')],
                P1786: [claim('西鄂侯')],
                P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }],
              },
            },
          },
        }),
      }) as unknown as Response) as unknown as typeof fetch;

    const names = (await fetchWikidataTypedNames(['Q11332'], fetchImpl)).get('Q11332')!;
    expect(names).toEqual(
      expect.arrayContaining([
        { text: '張衡', type: 'primary', lang: 'zh-hant' },
        { text: '平子', type: 'courtesy', lang: 'zh' },
        { text: '西鄂侯', type: 'posthumous', lang: 'zh' },
      ]),
    );
    expect(names).toHaveLength(3);

    // second call is served from the session cache
    await fetchWikidataTypedNames(['Q11332'], fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('caches empty typed names on fetch failure', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect((await fetchWikidataTypedNames(['Q1'], fetchImpl)).get('Q1')).toEqual([]);
    await fetchWikidataTypedNames(['Q1'], fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
