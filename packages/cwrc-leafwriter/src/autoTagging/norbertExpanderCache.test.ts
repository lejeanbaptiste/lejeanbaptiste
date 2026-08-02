import {
  clearNorbertExpanderCache,
  getCachedNorbertExpanderCandidates,
} from './norbertExpanderCache';

const wrapperRow = JSON.stringify({
  source: 'Norbert',
  authorityId: 'wrapper-1',
  kind: 'person',
  primaryName: '曹操',
  searchStrings: ['魏武帝曹操'],
  metadata: { wrapper: { components: { persName: '曹操' } } },
});

const wikiRow = JSON.stringify({
  source: 'Norbert',
  authorityId: 'wiki-1',
  kind: 'person',
  primaryName: '曹操',
  searchStrings: ['曹操'],
  metadata: {
    isNobleTitle: true,
    dynasty: '魏',
    nobleTitle: { fief: '魏', roleName: '帝', posthumousName: '武' },
    wrapper: { components: { persName: '曹操' } },
  },
});

describe('Norbert expander cache', () => {
  afterEach(() => clearNorbertExpanderCache());

  it('shares expanded candidates until authority pack contents are refreshed', async () => {
    const readPack = jest.fn(async (packId: string) =>
      packId === 'norbert-person-wrappers' ? [wrapperRow] : [wikiRow],
    );

    const [first, second] = await Promise.all([
      getCachedNorbertExpanderCandidates(readPack),
      getCachedNorbertExpanderCandidates(readPack),
    ]);
    expect(first).toHaveLength(3);
    expect(second).toBe(first);
    expect(readPack).toHaveBeenCalledTimes(2);

    clearNorbertExpanderCache();
    await getCachedNorbertExpanderCandidates(readPack);
    expect(readPack).toHaveBeenCalledTimes(4);
  });
});
