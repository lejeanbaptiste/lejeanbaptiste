import { fetchWikidataPersonWorks } from './wikidataPersonWorks';

const jsonResponse = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

describe('fetchWikidataPersonWorks', () => {
  it('reads P800 work ids and resolves their labels', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          entities: {
            Q100: {
              claims: {
                P800: [
                  {
                    mainsnak: {
                      snaktype: 'value',
                      datavalue: { value: { id: 'Q200' } },
                    },
                  },
                ],
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          entities: { Q200: { labels: { en: { language: 'en', value: 'A notable work' } } } },
        }),
      );

    await expect(fetchWikidataPersonWorks('Q100', fetchImpl)).resolves.toEqual([
      { qid: 'Q200', label: 'A notable work' },
    ]);
  });
});
