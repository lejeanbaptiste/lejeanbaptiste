import { updateResultsAfterSingleReplace } from './updateResultsAfterReplace';

describe('updateResultsAfterSingleReplace', () => {
  test('updates matches for one file without touching others', () => {
    const results = [
      {
        filePath: '/a.xml',
        filename: 'a.xml',
        matches: [
          {
            matchIndex: 0,
            start: 10,
            end: 13,
            line: 1,
            column: 11,
            snippet: { prefix: '', match: 'cat', suffix: '' },
          },
        ],
      },
      {
        filePath: '/b.xml',
        filename: 'b.xml',
        matches: [
          {
            matchIndex: 0,
            start: 5,
            end: 8,
            line: 1,
            column: 6,
            snippet: { prefix: '', match: 'cat', suffix: '' },
          },
        ],
      },
    ];

    const updatedContent = '<root>cat and cat</root>';
    const { results: nextResults, totalMatches } = updateResultsAfterSingleReplace(
      results,
      '/a.xml',
      updatedContent,
      'cat',
      false,
    );

    expect(totalMatches).toBe(3);
    expect(nextResults.find((file) => file.filePath === '/b.xml')?.matches).toHaveLength(1);
    expect(nextResults.find((file) => file.filePath === '/a.xml')?.matches).toHaveLength(2);
  });

  test('incrementally removes a replaced hit and shifts later offsets', () => {
    const results = [
      {
        filePath: '/a.xml',
        filename: 'a.xml',
        matches: [
          {
            matchIndex: 0,
            start: 10,
            end: 13,
            line: 1,
            column: 11,
            snippet: { prefix: '', match: 'cat', suffix: '' },
          },
          {
            matchIndex: 1,
            start: 20,
            end: 23,
            line: 1,
            column: 21,
            snippet: { prefix: '', match: 'cat', suffix: '' },
          },
        ],
      },
    ];

    const updatedContent = '<root>dog and cat</root>';
    const { results: nextResults, totalMatches } = updateResultsAfterSingleReplace(
      results,
      '/a.xml',
      updatedContent,
      'cat',
      false,
      { start: 10, end: 13, replacementLength: 3 },
    );

    expect(totalMatches).toBe(1);
    expect(nextResults[0]?.matches[0]?.start).toBe(20);
  });
});
