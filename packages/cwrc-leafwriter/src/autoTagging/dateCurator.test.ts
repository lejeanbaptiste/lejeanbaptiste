import {
  canAcceptDateSuggestion,
  finalizeDateSuggestion,
  isDateCuratorBatch,
  priorAcceptedDates,
} from './dateCurator';
import { Suggestion } from './types';

const dateSuggestion = (overrides: Partial<Suggestion> = {}): Suggestion => ({
  id: 'date_0',
  source: 'dates',
  sourceDetail: 'sanmiao',
  action: 'add',
  tag: 'date',
  anchor: {
    documentId: 'doc',
    xpath: '/TEI/text/body/p[1]/text()[1]',
    offset: 0,
    surface: '義熙八年',
    occurrence: 1,
    contextBefore: '',
    contextAfter: '',
    nodeHash: 'n1',
  },
  status: 'pending',
  dateResolution: {
    status: 'unique',
    candidates: [{ displayLine: '東晉義熙八年 = 412 CE', attrs: { when: '412-01-01' } }],
    parseXml: '<era>義熙</era><year>八年</year>',
  },
  ...overrides,
});

describe('isDateCuratorBatch', () => {
  it('is true for resolve-date batches', () => {
    expect(
      isDateCuratorBatch([
        dateSuggestion({ action: 'resolve-date', dateResolution: { status: 'unique', candidates: [] } }),
      ]),
    ).toBe(true);
  });

  it('is false for tag-only batches', () => {
    expect(isDateCuratorBatch([dateSuggestion({ dateResolution: { status: 'tagged', candidates: [] } })])).toBe(
      false,
    );
  });

  it('is false when mixed with dictionary suggestions', () => {
    expect(
      isDateCuratorBatch([
        dateSuggestion(),
        { ...dateSuggestion({ id: 'dict_0', source: 'dictionary' }) },
      ]),
    ).toBe(false);
  });
});

describe('canAcceptDateSuggestion', () => {
  it('allows unique dates without an explicit pick', () => {
    expect(canAcceptDateSuggestion(dateSuggestion(), null)).toBe(true);
  });

  it('requires a pick for ambiguous multi-candidate dates', () => {
    const ambiguous = dateSuggestion({
      dateResolution: {
        status: 'ambiguous',
        candidates: [
          { displayLine: 'A', attrs: { when: '100-01-01' } },
          { displayLine: 'B', attrs: { when: '200-01-01' } },
        ],
      },
    });
    expect(canAcceptDateSuggestion(ambiguous, null)).toBe(false);
    expect(canAcceptDateSuggestion(ambiguous, 1)).toBe(true);
  });
});

describe('finalizeDateSuggestion', () => {
  it('merges the selected candidate attrs for ambiguous dates', () => {
    const suggestion = dateSuggestion({
      attributes: { resp: '#ljb-sanmiao', cert: 'low' },
      dateResolution: {
        status: 'ambiguous',
        candidates: [
          { displayLine: 'A', attrs: { when: '100-01-01' } },
          { displayLine: 'B', attrs: { when: '200-01-01' } },
        ],
      },
    });
    finalizeDateSuggestion(suggestion, 1);
    expect(suggestion.attributes).toEqual({
      resp: '#ljb-sanmiao',
      cert: 'high',
      when: '200-01-01',
    });
    expect(suggestion.dateResolution?.selectedCandidateIndex).toBe(1);
  });
});

describe('priorAcceptedDates', () => {
  it('lists only accepted dates before the current row', () => {
    const suggestions: Suggestion[] = [
      { ...dateSuggestion({ id: 'date_0' }), status: 'accepted' },
      { ...dateSuggestion({ id: 'date_1', anchor: { ...dateSuggestion().anchor, surface: '三月' } }), status: 'pending' },
    ];
    const prior = priorAcceptedDates(suggestions, 'date_1');
    expect(prior).toHaveLength(1);
    expect(prior[0]!.surface).toBe('義熙八年');
  });
});
