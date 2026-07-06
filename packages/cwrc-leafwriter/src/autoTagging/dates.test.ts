import {
  buildDateTagChunks,
  buildTaggableDocIndex,
  dateResolveFromDocument,
  dateTagOnlyFromSanmiao,
  findTeiBodyRoot,
  offsetToRawRange,
  sequentialMatchOffsets,
  type SanmiaoProposal,
} from './dates';

const policy = 'ignore' as const;

function docFromBody(inner: string): Document {
  const xml = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>${inner}</body></text></TEI>`;
  return new DOMParser().parseFromString(xml, 'application/xml');
}

describe('sequentialMatchOffsets', () => {
  it('matches proposals in document order', () => {
    const text = '義熙八年，義熙九年';
    const proposals: SanmiaoProposal[] = [
      { date_index: 0, date_string: '義熙八年', status: 'unique', candidates: [] },
      { date_index: 1, date_string: '義熙九年', status: 'unique', candidates: [] },
    ];
    const matched = sequentialMatchOffsets(text, proposals);
    expect(matched.map((m) => m.offset)).toEqual([0, 5]);
  });
});

describe('buildTaggableDocIndex', () => {
  it('skips text inside existing date elements', () => {
    const doc = docFromBody('<p>outside <date>inside</date> more</p>');
    const index = buildTaggableDocIndex(findTeiBodyRoot(doc), policy);
    expect(index.text).toBe('outsidemore');
  });
});

describe('buildDateTagChunks', () => {
  it('uses one whole-body chunk for typical documents', () => {
    const doc = docFromBody('<p>義熙八年</p><p>義熙九年</p>');
    const bodyRoot = findTeiBodyRoot(doc);
    const index = buildTaggableDocIndex(bodyRoot, policy);
    const chunks = buildDateTagChunks(doc, bodyRoot, index, policy);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe(index.text);
    expect(chunks[0]!.start).toBe(0);
  });

  it('splits by paragraph when body exceeds the threshold', () => {
    const doc = docFromBody('<p>alpha</p><p>beta</p><p>gamma</p>');
    const bodyRoot = findTeiBodyRoot(doc);
    const index = buildTaggableDocIndex(bodyRoot, policy);
    const chunks = buildDateTagChunks(doc, bodyRoot, index, policy, 5);
    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.text)).toEqual(['alpha', 'beta', 'gamma']);
  });
});

describe('dateTagOnlyFromSanmiao', () => {
  it('maps mock tag proposals to anchored suggestions', async () => {
    const doc = docFromBody('<p>義熙八年</p>');
    const proposals: SanmiaoProposal[] = [
      {
        date_index: 0,
        date_string: '義熙八年',
        status: 'tagged',
        candidates: [],
        parseInnerXml: '<era>義熙</era><year>八年</year>',
      },
    ];
    const suggestions = await dateTagOnlyFromSanmiao(doc, policy, async (chunks) =>
      chunks.map(() => proposals),
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.tag).toBe('date');
    expect(suggestions[0]!.source).toBe('dates');
    expect(suggestions[0]!.anchor.surface).toBe('義熙八年');
    expect(suggestions[0]!.dateResolution?.status).toBe('tagged');
    expect(suggestions[0]!.attributes?.cert).toBe('low');
    expect(suggestions[0]!.dateResolution?.parseXml).toContain('義熙');
  });

  it('sends one sanmiao chunk for a typical body', async () => {
    const doc = docFromBody('<p>義熙八年</p><p>義熙九年</p>');
    let chunkCount = 0;
    await dateTagOnlyFromSanmiao(doc, policy, async (chunks) => {
      chunkCount = chunks.length;
      return chunks.map(() => []);
    });
    expect(chunkCount).toBe(1);
  });
});

describe('dateResolveFromDocument', () => {
  it('resolves existing date elements in document order', async () => {
    const doc = docFromBody(
      '<p><date cert="low"><era>義熙</era><year>元年</year></date>，<date cert="low"><year>三年</year></date></p>',
    );
    const suggestions = await dateResolveFromDocument(doc, policy, async (dates) =>
      dates.map((xml, index) =>
        index === 0
          ? {
              date_index: 0,
              date_string: '義熙元年',
              status: 'unique',
              candidates: [{ displayLine: '義熙元年', attrs: { when: '405-01-01' } }],
              attrs: { when: '405-01-01' },
            }
          : {
              date_index: 0,
              date_string: '三年',
              status: 'unique',
              candidates: [{ displayLine: '義熙三年', attrs: { when: '407-01-01' } }],
              attrs: { when: '407-01-01' },
            },
      ),
    );
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]!.action).toBe('resolve-date');
    expect(suggestions[0]!.anchor.surface).toBe('義熙');
    expect(suggestions[0]!.dateResolution?.displaySurface).toBe('義熙元年');
    expect(suggestions[1]!.action).toBe('resolve-date');
    expect(suggestions[1]!.anchor.surface).toBe('三');
    expect(suggestions[1]!.dateResolution?.displaySurface).toBe('三年');
  });

  it('stores full structured date on displaySurface while anchor matches first child', async () => {
    const doc = docFromBody(
      '<p><date cert="low"><dyn>魏</dyn><era>文帝黃初</era><year>二年</year><month>六月</month><day>戊辰</day><lp>晦</lp></date></p>',
    );
    const suggestions = await dateResolveFromDocument(doc, policy, async () => [
      {
        date_index: 0,
        date_string: '魏文帝黃初二年六月戊辰晦',
        status: 'unique',
        candidates: [{ displayLine: '三國魏文帝黃初二年六月戊辰晦', attrs: { when: '221-08-05' } }],
        attrs: { when: '221-08-05' },
      },
    ]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.anchor.surface).toBe('魏');
    expect(suggestions[0]!.dateResolution?.displaySurface).toBe('魏文帝黃初二年六月戊辰晦');
  });
});

describe('offsetToRawRange', () => {
  it('maps flat offset back to a text node', () => {
    const doc = docFromBody('<p>abc</p>');
    const index = buildTaggableDocIndex(findTeiBodyRoot(doc), policy);
    const range = offsetToRawRange(index, 0, 3);
    expect(range?.node.data).toBe('abc');
  });
});
