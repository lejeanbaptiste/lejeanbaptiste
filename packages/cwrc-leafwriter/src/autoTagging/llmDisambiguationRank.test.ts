import type { LlmClient, LlmRequest, LlmResponse } from './llmClient';
import { DisambiguationAiCache } from './disambiguationAiCache';
import { createAnchor } from './anchor';
import { rankDisambiguationCandidates } from './llmDisambiguationRank';
import type { DisambiguationCandidate } from './disambiguationCandidates';
import type { MentionInstance } from './mentions';

class FakeClient implements LlmClient {
  modelId = 'fake:rank';
  calls = 0;

  constructor(private readonly responder: (req: LlmRequest) => string) {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    this.calls += 1;
    return {
      json: this.responder(req),
      usage: { inputTokens: 12, outputTokens: 34 },
    };
  }
}

const makeDoc = () =>
  new DOMParser().parseFromString(
    '<TEI><text><body><p>沈攸之在此</p></body></text></TEI>',
    'application/xml',
  );

const makeDatedDoc = () =>
  new DOMParser().parseFromString(
    '<TEI><text><body><p><date when="1000"/>廣州</p></body></text></TEI>',
    'application/xml',
  );

const makeInstance = (): MentionInstance => {
  const doc = makeDoc();
  const element = doc.getElementsByTagName('p')[0]!;
  const textNode = element.firstChild as Text;
  const anchor = createAnchor('doc-1', doc, textNode, 0, textNode.data.length, 'ignore');
  return {
    documentId: 'doc-1',
    tag: 'persName',
    surface: '沈攸之',
    element,
    anchor,
    hasKey: false,
    isUnresolved: true,
  };
};

const makeCandidates = (): DisambiguationCandidate[] => [
  {
    id: 'cand-1',
    label: '沈攸之',
    description: 'better contextual fit',
    sources: ['Wikidata'],
    uri: 'https://www.wikidata.org/wiki/Q123',
  },
  {
    id: 'cand-2',
    label: '沈攸之 (other)',
    description: 'less likely',
    sources: ['VIAF'],
    uri: 'https://viaf.org/viaf/456',
  },
];

describe('rankDisambiguationCandidates', () => {
  it('parses the model response, surfaces selected ids, and reuses the cache', async () => {
    const doc = makeDoc();
    const instance = makeInstance();
    const candidates = makeCandidates();
    const client = new FakeClient(() =>
      JSON.stringify({
        selectedCandidateIds: ['cand-1'],
        rationales: { 'cand-1': 'Best contextual fit' },
        confidences: { 'cand-1': 0.93 },
        suggestCreateNew: false,
      }),
    );
    const cache = new DisambiguationAiCache(null, null);

    const first = await rankDisambiguationCandidates({
      doc,
      instance,
      candidates,
      client,
      cache,
    });

    expect(client.calls).toBe(1);
    expect(first).toEqual({
      selectedCandidateIds: ['cand-1'],
      rationales: { 'cand-1': 'Best contextual fit' },
      confidences: { 'cand-1': 0.93 },
      suggestCreateNew: false,
      createNewRationale: undefined,
    });

    const second = await rankDisambiguationCandidates({
      doc,
      instance,
      candidates,
      client,
      cache,
    });

    expect(client.calls).toBe(1);
    expect(second).toEqual(first);
  });

  it('asks the model to respond in the preferred UI language', async () => {
    const doc = makeDoc();
    const instance = makeInstance();
    const candidates = makeCandidates();
    const client = new FakeClient((req) => {
      expect(req.system).toContain('Respond in English.');
      return JSON.stringify({
        selectedCandidateIds: ['cand-1'],
        rationales: { 'cand-1': 'Best contextual fit' },
        confidences: { 'cand-1': 0.93 },
        suggestCreateNew: false,
      });
    });

    await rankDisambiguationCandidates({
      doc,
      instance,
      candidates,
      client,
      preferredLanguage: 'en',
    });
  });

  it('returns null for model output that does not select any candidate', async () => {
    const doc = makeDoc();
    const instance = makeInstance();
    const client = new FakeClient(() =>
      JSON.stringify({
        selectedCandidateIds: [],
        rationales: {},
        confidences: {},
        suggestCreateNew: false,
      }),
    );

    const result = await rankDisambiguationCandidates({
      doc,
      instance,
      candidates: makeCandidates(),
      client,
    });

    expect(result).toEqual({
      selectedCandidateIds: [],
      rationales: {},
      confidences: {},
      suggestCreateNew: false,
      createNewRationale: undefined,
    });
  });

  it('falls back to a unique exact-label dated overlap when the model abstains', async () => {
    const doc = makeDatedDoc();
    const element = doc.getElementsByTagName('p')[0]!;
    const textNode = element.lastChild as Text;
    const anchor = createAnchor('doc-1', doc, textNode, 0, textNode.data.length, 'ignore');
    const instance: MentionInstance = {
      documentId: 'doc-1',
      tag: 'placeName',
      surface: '廣州',
      element,
      anchor,
      hasKey: false,
      isUnresolved: true,
    };
    const candidates: DisambiguationCandidate[] = [
      { id: 'cand-1', label: '廣州', sources: ['CBDB'], startYear: 908, endYear: 1121 },
      { id: 'cand-2', label: '廣州府', sources: ['CBDB'], startYear: 1368, endYear: 1643 },
      { id: 'cand-3', label: '廣州市', sources: ['CBDB'], startYear: 1949, endYear: 2005 },
    ];
    const client = new FakeClient(() =>
      JSON.stringify({
        selectedCandidateIds: [],
        rationales: {},
        confidences: {},
        suggestCreateNew: false,
      }),
    );

    const result = await rankDisambiguationCandidates({
      doc,
      instance,
      candidates,
      client,
    });

    expect(result).toEqual({
      selectedCandidateIds: ['cand-1'],
      rationales: {
        'cand-1': 'Fallback: exact label match and only dated candidate overlapping the document span.',
      },
      confidences: {
        'cand-1': 0.56,
      },
      suggestCreateNew: false,
      createNewRationale: undefined,
    });
  });
});
