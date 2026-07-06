import { defaultAiTagSelection, listAiTagOptions } from './aiTagOptions';

describe('aiTagOptions', () => {
  it('includes crawl defaults and tag definitions', () => {
    const options = listAiTagOptions(null);
    expect(options).toContain('persName');
    expect(options).toContain('placeName');
    expect(options).toContain('roleName');
  });

  it('merges schema parent tags when available', () => {
    const options = listAiTagOptions({
      schemaManager: {
        mapper: {
          getEntitiesMapping: () =>
            new Map([
              ['person', { parentTag: 'persName' }],
              ['place', { parentTag: ['placeName', 'geogName'] }],
            ]),
        },
      },
    });
    expect(options).toContain('geogName');
  });

  it('defaults to persName and placeName when present', () => {
    expect(defaultAiTagSelection(['date', 'persName', 'placeName'])).toEqual([
      'persName',
      'placeName',
    ]);
  });
});
