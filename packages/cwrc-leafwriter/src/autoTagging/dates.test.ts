import {
  buildDateTagChunks,
  buildTaggableDocIndex,
  collectBodyDatesInOrder,
  createDateReviewRecalculator,
  dateResolveFromDocument,
  dateTagOnlyFromSanmiao,
  findTeiBodyRoot,
  offsetToRawRange,
  sequenceSuppressedIndices,
  sequentialMatchOffsets,
  type SanmiaoProposal,
} from './dates';

const policy = 'ignore' as const;

function docFromBody(inner: string): Document {
  const source = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>${inner}</body></text></TEI>`;
  return new DOMParser().parseFromString(source, 'application/xml');
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
      dates.map((_date, index) =>
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

  it('strips entity tags from parsed date xml before storing resolution', async () => {
    const doc = docFromBody('<p>義熙八年</p>');
    const suggestions = await dateTagOnlyFromSanmiao(doc, policy, async () => [
      [
        {
          date_index: 0,
          date_string: '義熙八年',
          status: 'tagged',
          candidates: [],
          parseInnerXml: '<era>義熙</era><placeName>洛陽</placeName><year>八年</year>',
        },
      ],
    ]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.dateResolution?.parseXml).toContain('<era>義熙</era>');
    expect(suggestions[0]!.dateResolution?.parseXml).toContain('<year>八年</year>');
    expect(suggestions[0]!.dateResolution?.parseXml).not.toContain('placeName');
    expect(suggestions[0]!.dateResolution?.parseXml).toContain('洛陽');
  });
});

describe('createDateReviewRecalculator', () => {
  it('sends confirmed attributes as anchors and excludes rejected rows from sequence state', async () => {
    const doc = docFromBody(
      '<p><date><era>建元</era><year>元年</year></date><date><month>四月</month></date></p>',
    );
    let recalculationInput: string[] = [];
    const current = await dateResolveFromDocument(doc, policy, async (dates) =>
      dates.map((_date, index) => ({
        date_index: index,
        date_string: index === 0 ? '建元元年' : '四月',
        status: 'unique' as const,
        candidates: [{ displayLine: index === 0 ? '建元元年' : '四月', attrs: {} }],
      })),
    );
    current[0]!.status = 'accepted';
    current[0]!.attributes = { era_id: '12', year: '1', cert: 'high' };
    current[1]!.status = 'rejected';

    const recalculate = createDateReviewRecalculator(doc, policy, async (dates) => {
      recalculationInput = dates;
      return dates.map((_date, index) => ({
        date_index: index,
        date_string: index === 0 ? '建元元年' : '四月',
        status: 'unique' as const,
        candidates: [{ displayLine: index === 0 ? '建元元年' : '四月', attrs: {} }],
      }));
    });
    const result = await recalculate(current);

    expect(recalculationInput[0]).toContain('era_id="12"');
    expect(recalculationInput[1]).toBe('<date xmlns="http://www.tei-c.org/ns/1.0"/>');
    expect(result.map((suggestion) => suggestion.status)).toEqual(['accepted', 'rejected']);
  });

  it('treats a pending row with a chosen candidate as a sequence anchor for later relatives', async () => {
    // 建元元年 (chosen, still pending) should re-anchor 四年 even before Accept.
    const doc = docFromBody(
      '<p><date><era>建元</era><year>元年</year></date><date><year>四年</year></date></p>',
    );
    let recalculationInput: string[] = [];
    const current = await dateResolveFromDocument(doc, policy, async (dates) =>
      dates.map((_date, index) => ({
        date_index: index,
        date_string: index === 0 ? '建元元年' : '四年',
        status: (index === 0 ? 'ambiguous' : 'unique') as 'ambiguous' | 'unique',
        candidates:
          index === 0
            ? [
                {
                  displayLine: '劉宋昇明…',
                  attrs: { era_id: '271', year: '1', ind_year: '477' },
                },
                {
                  displayLine: '南齊建元元年（479）',
                  attrs: { era_id: '272', year: '1', ind_year: '479' },
                },
              ]
            : [{ displayLine: '劉宋昇明四年（480）', attrs: { era_id: '271', year: '4' } }],
      })),
    );
    // User picks Southern Qi Jianyuan without accepting yet.
    current[0]!.status = 'pending';
    current[0]!.dateResolution!.selectedCandidateIndex = 1;
    current[0]!.dateResolution!.userLocked = true;
    current[0]!.attributes = {
      resp: '#grognard-sanmiao',
      cert: 'high',
      era_id: '272',
      year: '1',
      ind_year: '479',
    };

    const recalculate = createDateReviewRecalculator(doc, policy, async (dates) => {
      recalculationInput = dates;
      return dates.map((_date, index) => ({
        date_index: index,
        date_string: index === 0 ? '建元元年' : '四年',
        status: 'unique' as const,
        candidates: [
          {
            displayLine:
              index === 0 ? '南齊建元元年（479）' : '南齊太祖高皇帝蕭道成建元四年（482）',
            attrs:
              index === 0
                ? { era_id: '272', year: '1', ind_year: '479' }
                : { era_id: '272', year: '4', ind_year: '482' },
          },
        ],
      }));
    });
    const result = await recalculate(current);

    expect(recalculationInput[0]).toContain('era_id="272"');
    expect(recalculationInput[0]).toContain('year="1"');
    // Chosen pending row is preserved; open relative is refreshed from the new sequence.
    expect(result[0]).toBe(current[0]);
    expect(result[0]!.status).toBe('pending');
    expect(result[1]!.dateResolution?.candidates?.[0]?.displayLine).toContain('建元四年');
    expect(result[1]!.status).toBe('pending');
  });

  it('strips stale attrs from later auto-unique dates so they re-resolve after an earlier choice', async () => {
    const doc = docFromBody(
      '<p><date><era>建元</era><year>元年</year></date><date><year>四年</year></date></p>',
    );
    let recalculationInput: string[] = [];
    const current = await dateResolveFromDocument(doc, policy, async (dates) =>
      dates.map((_date, index) => ({
        date_index: index,
        date_string: index === 0 ? '建元元年' : '四年',
        status: (index === 0 ? 'ambiguous' : 'unique') as 'ambiguous' | 'unique',
        candidates:
          index === 0
            ? [
                {
                  displayLine: '劉宋昇明…',
                  attrs: { era_id: '271', year: '1', ind_year: '477' },
                },
                {
                  displayLine: '南齊建元元年（479）',
                  attrs: { era_id: '272', year: '1', ind_year: '479' },
                },
              ]
            : [
                {
                  displayLine: '劉宋昇明四年（480）',
                  attrs: { era_id: '271', year: '4', ind_year: '480' },
                },
              ],
      })),
    );
    // User picks Southern Qi; 四年 was auto-accepted with the wrong era attrs.
    current[0]!.status = 'pending';
    current[0]!.dateResolution!.selectedCandidateIndex = 1;
    current[0]!.dateResolution!.userLocked = true;
    current[0]!.attributes = {
      resp: '#grognard-sanmiao',
      cert: 'high',
      era_id: '272',
      year: '1',
      ind_year: '479',
    };
    current[1]!.status = 'accepted';
    current[1]!.attributes = {
      resp: '#grognard-sanmiao',
      cert: 'high',
      era_id: '271',
      year: '4',
      ind_year: '480',
    };

    const recalculate = createDateReviewRecalculator(doc, policy, async (dates) => {
      recalculationInput = dates;
      return dates.map((_date, index) => ({
        date_index: index,
        date_string: index === 0 ? '建元元年' : '四年',
        status: 'unique' as const,
        candidates: [
          {
            displayLine:
              index === 0 ? '南齊建元元年（479）' : '南齊太祖高皇帝蕭道成建元四年（482）',
            attrs:
              index === 0
                ? { era_id: '272', year: '1', ind_year: '479' }
                : { era_id: '272', year: '4', ind_year: '482' },
          },
        ],
      }));
    });
    const result = await recalculate(current);

    expect(recalculationInput[0]).toContain('era_id="272"');
    // Stale 昇明 attrs must not be sent — only parse children.
    expect(recalculationInput[1]).not.toContain('era_id="271"');
    expect(recalculationInput[1]).toContain('<year');
    expect(result[1]!.dateResolution?.candidates?.[0]?.displayLine).toContain('建元四年');
    expect(result[1]!.status).toBe('pending');
  });

  it('keeps a locked 建元元年 row when a later date is disambiguated', async () => {
    const doc = docFromBody(
      '<p><date><era>建元</era><year>元年</year></date><date>明年</date></p>',
    );
    const current = await dateResolveFromDocument(doc, policy, async (dates) =>
      dates.map((_date, index) => ({
        date_index: index,
        date_string: index === 0 ? '建元元年' : '明年',
        status: 'ambiguous' as const,
        candidates:
          index === 0
            ? [
                {
                  displayLine: '劉宋昇明元年',
                  attrs: { era_id: '271', year: '1', ind_year: '477' },
                },
                {
                  displayLine: '南齊建元元年（479）',
                  attrs: { era_id: '272', year: '1', ind_year: '479' },
                },
              ]
            : [
                {
                  displayLine: 'Insufficient data',
                  attrs: {},
                },
                {
                  displayLine: '南齊建元二年（480）',
                  attrs: { era_id: '272', year: '2', ind_year: '480' },
                },
              ],
      })),
    );
    // User locked 建元 (accepted after pick).
    current[0]!.status = 'accepted';
    current[0]!.dateResolution!.selectedCandidateIndex = 1;
    current[0]!.dateResolution!.userLocked = true;
    current[0]!.attributes = {
      resp: '#grognard-sanmiao',
      cert: 'high',
      era_id: '272',
      year: '1',
      ind_year: '479',
    };
    // Then picks 明年 — must not undo 建元.
    current[1]!.status = 'pending';
    current[1]!.dateResolution!.selectedCandidateIndex = 1;
    current[1]!.dateResolution!.userLocked = true;
    current[1]!.attributes = {
      resp: '#grognard-sanmiao',
      cert: 'high',
      era_id: '272',
      year: '2',
      ind_year: '480',
    };

    const recalculate = createDateReviewRecalculator(doc, policy, async (dates) =>
      dates.map((_date, index) => ({
        date_index: index,
        date_string: index === 0 ? '建元元年' : '明年',
        status: 'unique' as const,
        candidates: [
          {
            displayLine:
              index === 0 ? 'WRONG — should not replace locked 建元' : '南齊建元二年（480）',
            attrs:
              index === 0
                ? { era_id: '999', year: '1', ind_year: '1' }
                : { era_id: '272', year: '2', ind_year: '480' },
          },
        ],
      })),
    );
    const result = await recalculate(current);

    expect(result[0]).toBe(current[0]);
    expect(result[0]!.attributes?.era_id).toBe('272');
    expect(result[0]!.dateResolution?.userLocked).toBe(true);
    expect(result[0]!.dateResolution?.candidates?.[1]?.displayLine).toContain('建元元年');
    expect(result[1]).toBe(current[1]);
  });

  it('skips intervening flashback dates when attachToDateIndex points at an earlier prior', async () => {
    // 1 建元元年 → 2 flashback 漢 → 3 四年 should inherit from 1, not 2.
    const doc = docFromBody('<p><date>建元元年</date><date>漢高祖元年</date><date>四年</date></p>');
    let recalculationInput: string[] = [];
    const current = await dateResolveFromDocument(doc, policy, async (dates) =>
      dates.map((_date, index) => ({
        date_index: index,
        date_string: index === 0 ? '建元元年' : index === 1 ? '漢高祖元年' : '四年',
        status: 'unique' as const,
        candidates: [
          {
            displayLine:
              index === 0 ? '南齊建元元年（479）' : index === 1 ? '漢高祖元年' : '漢高祖四年',
            attrs:
              index === 0
                ? { era_id: '272', year: '1', ind_year: '479' }
                : index === 1
                  ? { era_id: '1', year: '1', ind_year: '-206' }
                  : { era_id: '1', year: '4' },
          },
        ],
      })),
    );
    current[0]!.status = 'accepted';
    current[0]!.attributes = { era_id: '272', year: '1', ind_year: '479', cert: 'high' };
    current[1]!.status = 'accepted';
    current[1]!.attributes = { era_id: '1', year: '1', ind_year: '-206', cert: 'high' };
    current[2]!.status = 'pending';
    current[2]!.dateResolution!.attachToDateIndex = 0;
    delete current[2]!.attributes;

    const recalculate = createDateReviewRecalculator(doc, policy, async (dates) => {
      recalculationInput = dates;
      return dates.map((_date, index) => ({
        date_index: index,
        date_string: index === 0 ? '建元元年' : index === 1 ? '' : '四年',
        status: 'unique' as const,
        candidates: [
          {
            displayLine:
              index === 2 ? '南齊建元四年（482）' : index === 0 ? '南齊建元元年（479）' : '',
            attrs:
              index === 2
                ? { era_id: '272', year: '4', ind_year: '482' }
                : index === 0
                  ? { era_id: '272', year: '1', ind_year: '479' }
                  : {},
          },
        ],
      }));
    });
    const result = await recalculate(current);

    expect(sequenceSuppressedIndices(current).has(1)).toBe(true);
    // Flashback blanked for sequence; anchor date keeps attrs; relative refreshes.
    expect(recalculationInput[0]).toContain('era_id="272"');
    expect(recalculationInput[1]).toBe('<date xmlns="http://www.tei-c.org/ns/1.0"/>');
    expect(result[1]).toBe(current[1]);
    expect(result[2]!.dateResolution?.attachToDateIndex).toBe(0);
    expect(result[2]!.dateResolution?.candidates?.[0]?.displayLine).toContain('建元四年');
  });
});

describe('sequenceSuppressedIndices', () => {
  it('marks indices strictly between attach target and the attaching row', () => {
    const current = [
      { dateResolution: {} },
      { dateResolution: {} },
      { dateResolution: { attachToDateIndex: 0 } },
    ] as import('./types').Suggestion[];
    expect([...sequenceSuppressedIndices(current)].sort()).toEqual([1]);
  });
});

describe('collectBodyDatesInOrder', () => {
  it('excludes sic/surplus text from the serialized outerXml sent to sanmiao', () => {
    const doc = docFromBody('<date><choice><sic>太</sic><corr>建</corr></choice>元元年</date>');
    const entries = collectBodyDatesInOrder(findTeiBodyRoot(doc), policy);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.outerXml).not.toContain('太');
    expect(entries[0]!.outerXml).toContain('<corr>建</corr>');
    expect(entries[0]!.outerXml).toContain('元元年');
  });

  it('still strips sic/surplus when the date already carries prior sanmiao attributes', () => {
    // Reproduces the report: re-resolving a <date> that a prior sanmiao pass
    // already annotated (dyn_id/era_id/etc.) must not resend the raw sic text.
    const doc = docFromBody(
      '<date dyn_id="84" ruler_id="7605" era_id="272" year="1" cert="high" cal_stream="1" ind_year="479" sex_year="56"><choice><sic>太</sic><corr>建</corr></choice>元元年</date>',
    );
    const entries = collectBodyDatesInOrder(findTeiBodyRoot(doc), policy);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.outerXml).not.toContain('太');
    expect(entries[0]!.outerXml).toContain('era_id="272"');
    expect(entries[0]!.outerXml).toContain('<corr>建</corr></choice>元元年');
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
