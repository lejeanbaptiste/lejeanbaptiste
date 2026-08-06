import { fetchWikidataWorkDetails } from './wikidataWorkDetails';

const responseFor = (claims: Record<string, unknown[]>) =>
  ({
    ok: true,
    json: async () => ({
      entities: {
        Q1137686: { claims, labels: { en: { value: 'Nanshi' } } },
      },
    }),
  }) as Response;

const responseWithLabels = (labels: Record<string, string>) =>
  ({
    ok: true,
    json: async () => ({
      entities: {
        Q1137686: {
          claims: { P571: [timeClaim('+0480-01-01T00:00:00Z')] },
          labels: Object.fromEntries(
            Object.entries(labels).map(([lang, value]) => [lang, { value }]),
          ),
        },
      },
    }),
  }) as Response;

const timeClaim = (time: string) => ({
  mainsnak: {
    snaktype: 'value',
    datavalue: { value: { time, precision: 9 } },
  },
});

describe('fetchWikidataWorkDetails', () => {
  it('uses inception when publication date is absent', async () => {
    const details = await fetchWikidataWorkDetails('Q1137686', async () =>
      responseFor({ P571: [timeClaim('+0480-01-01T00:00:00Z')] }),
    );

    expect(details?.publicationYear).toBe(480);
  });

  it('prefers publication date when both dates are present', async () => {
    const details = await fetchWikidataWorkDetails('Q1137686', async () =>
      responseFor({
        P571: [timeClaim('+0480-01-01T00:00:00Z')],
        P577: [timeClaim('+0500-01-01T00:00:00Z')],
      }),
    );

    expect(details?.publicationYear).toBe(500);
  });

  it('includes extraLanguages in the requested titles when the entity has those labels', async () => {
    let requestedUrl = '';
    const fetchImpl = async (url: string) => {
      requestedUrl = url;
      return responseWithLabels({ en: 'Nanshi', fr: 'Nanshi (français)', de: 'Nanshi (deutsch)' });
    };

    const details = await fetchWikidataWorkDetails('Q1137686', fetchImpl, null, ['fr', 'de']);

    expect(requestedUrl).toContain('languages=en|fr|de');
    expect(details?.titles).toEqual(
      expect.arrayContaining([
        { language: 'en', label: 'Nanshi' },
        { language: 'fr', label: 'Nanshi (français)' },
        { language: 'de', label: 'Nanshi (deutsch)' },
      ]),
    );
  });

  it('omits an extraLanguages entry the entity has no label for', async () => {
    const details = await fetchWikidataWorkDetails(
      'Q1137686',
      async () => responseWithLabels({ en: 'Nanshi', fr: 'Nanshi (français)' }),
      null,
      ['fr', 'de'],
    );

    expect(details?.titles.map((title) => title.language)).toEqual(['en', 'fr']);
  });

  it('defaults to en + desktopLanguage only when extraLanguages is omitted (regression)', async () => {
    let requestedUrl = '';
    const fetchImpl = async (url: string) => {
      requestedUrl = url;
      return responseWithLabels({ en: 'Nanshi', fr: 'Nanshi (français)' });
    };

    const details = await fetchWikidataWorkDetails('Q1137686', fetchImpl, 'de');

    expect(requestedUrl).toContain('languages=en|de');
    expect(details?.titles).toEqual([{ language: 'en', label: 'Nanshi' }]);
  });
});
