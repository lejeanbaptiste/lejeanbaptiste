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
});
