import type { LlmClient, LlmRequest, LlmResponse } from './llmClient';
import { normalizeDomText } from './normalize';
import type { Suggestion } from './types';
import {
  goldMentions,
  goldMentionsForAutoCorpus,
  runAuditValidationHarness,
  runManualAutoAuditHarness,
  runValidationHarness,
  scoreSuggestions,
  stripTags,
  type GoldMention,
} from './validationHarness';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const fakeSuggestion = (over: Partial<Suggestion> & { surface: string; occurrence: number }): Suggestion => ({
  id: 'x',
  source: 'ai',
  action: 'add',
  tag: over.tag ?? 'persName',
  status: 'pending',
  anchor: {
    documentId: '',
    xpath: '',
    offset: 0,
    surface: over.surface,
    occurrence: over.occurrence,
    contextBefore: '',
    contextAfter: '',
    nodeHash: '',
  },
  ...over,
});

describe('stripTags', () => {
  it('replaces single-text-child elements with their bare text content', () => {
    const doc = parse('<TEI><text><body><p><persName>張衡</persName>是天文學家</p></body></text></TEI>');
    const stripped = stripTags(doc, ['persName']);
    expect(stripped.getElementsByTagName('persName')).toHaveLength(0);
    expect(stripped.getElementsByTagName('p')[0]!.textContent).toBe('張衡是天文學家');
  });

  it('does not mutate the input document', () => {
    const doc = parse('<TEI><text><body><p><persName>張衡</persName>是天文學家</p></body></text></TEI>');
    stripTags(doc, ['persName']);
    expect(doc.getElementsByTagName('persName')).toHaveLength(1);
  });

  it('leaves untagged text untouched when tags is empty', () => {
    const doc = parse('<TEI><text><body><p><persName>張衡</persName></p></body></text></TEI>');
    const stripped = stripTags(doc, []);
    expect(stripped.getElementsByTagName('persName')).toHaveLength(1);
  });
});

describe('goldMentions', () => {
  it('extracts existing tagged mentions with document-wide occurrence numbering', () => {
    const doc = parse(
      '<TEI><text><body><p><persName>張衡</persName>與<placeName>洛陽</placeName>又見<persName>張衡</persName></p></body></text></TEI>',
    );
    const gold = goldMentions(doc, 'ignore', ['persName', 'placeName']);
    expect(gold).toEqual<GoldMention[]>([
      { tag: 'persName', surface: '張衡', occurrence: 1 },
      { tag: 'placeName', surface: '洛陽', occurrence: 1 },
      { tag: 'persName', surface: '張衡', occurrence: 2 },
    ]);
  });
});

describe('scoreSuggestions', () => {
  const gold: GoldMention[] = [
    { tag: 'persName', surface: '張衡', occurrence: 1 },
    { tag: 'placeName', surface: '洛陽', occurrence: 1 },
    { tag: 'persName', surface: '張衡', occurrence: 2 },
  ];

  it('scores a perfect prediction as full precision and recall', () => {
    const predicted = gold.map((g) => fakeSuggestion({ ...g }));
    const report = scoreSuggestions(gold, predicted);
    expect(report.overall).toMatchObject({ tp: 3, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1 });
  });

  it('counts a missed gold mention as a false negative', () => {
    const predicted = [fakeSuggestion(gold[0]!), fakeSuggestion(gold[1]!)];
    const report = scoreSuggestions(gold, predicted);
    expect(report.overall).toMatchObject({ tp: 2, fp: 0, fn: 1 });
    expect(report.byTag.persName).toMatchObject({ tp: 1, fp: 0, fn: 1 });
  });

  it('counts a spurious prediction (no matching gold span) as a false positive', () => {
    const predicted = [...gold.map((g) => fakeSuggestion({ ...g })), fakeSuggestion({ surface: '虛構', occurrence: 1, tag: 'persName' })];
    const report = scoreSuggestions(gold, predicted);
    expect(report.overall).toMatchObject({ tp: 3, fp: 1, fn: 0 });
  });

  it('counts a right-span-wrong-tag prediction against both tags and reports it separately', () => {
    const predicted = [
      fakeSuggestion({ surface: '張衡', occurrence: 1, tag: 'placeName' }), // should be persName
      fakeSuggestion(gold[1]!),
      fakeSuggestion(gold[2]!),
    ];
    const report = scoreSuggestions(gold, predicted);
    expect(report.overall).toMatchObject({ tp: 2, fp: 1, fn: 1 });
    expect(report.byTag.placeName).toMatchObject({ tp: 1, fp: 1, fn: 0 }); // "洛陽" TP, "張衡" FP
    expect(report.byTag.persName).toMatchObject({ tp: 1, fp: 0, fn: 1 }); // second 張衡 TP, first FN
    expect(report.wrongTag).toEqual([{ surface: '張衡', occurrence: 1, goldTag: 'persName', predictedTag: 'placeName' }]);
  });

  it('treats an empty gold and empty prediction as perfect (no evidence of failure)', () => {
    expect(scoreSuggestions([], []).overall).toMatchObject({ tp: 0, fp: 0, fn: 0, precision: 1, recall: 1 });
  });
});

class FakeClient implements LlmClient {
  modelId = 'fake:test';
  constructor(private readonly responder: (req: LlmRequest) => string) {}
  async complete(req: LlmRequest): Promise<LlmResponse> {
    return { json: this.responder(req), usage: { inputTokens: 1, outputTokens: 1 } };
  }
}

describe('runValidationHarness', () => {
  it('strips gold tags, runs suggest, and scores the result end to end', async () => {
    const doc = parse('<TEI><text><body><p><persName>張衡</persName>是天文學家</p></body></text></TEI>');
    const client = new FakeClient(() =>
      JSON.stringify({
        suggestions: [
          { surface: '張衡', occurrence: 1, tag: 'persName', action: 'add', confidence: 0.9, rationale: 'name' },
        ],
      }),
    );

    const report = await runValidationHarness(doc, { policy: 'ignore', tags: ['persName'], client });
    expect(report.overall).toMatchObject({ tp: 1, fp: 0, fn: 0 });
    expect(report.goldCount).toBe(1);
    expect(report.predictedCount).toBe(1);
    expect(report.unverifiableCount).toBe(0);
  });

  it('counts a hallucinated prediction dropped by anchor verification as unverifiable, not a false positive', async () => {
    const doc = parse('<TEI><text><body><p><persName>張衡</persName>是天文學家</p></body></text></TEI>');
    const client = new FakeClient(() =>
      JSON.stringify({
        suggestions: [
          { surface: '完全編造', occurrence: 1, tag: 'persName', action: 'add', confidence: 0.9, rationale: 'r' },
        ],
      }),
    );

    const report = await runValidationHarness(doc, { policy: 'ignore', tags: ['persName'], client });
    expect(report.unverifiableCount).toBe(1);
    expect(report.overall).toMatchObject({ tp: 0, fp: 0, fn: 1 }); // gold "張衡" missed entirely
  });
});

describe('runAuditValidationHarness', () => {
  it('runs suggest then audit and reports both stages', async () => {
    const doc = parse(
      '<TEI><text><body><p><persName>張衡</persName>與<placeName>洛陽</placeName></p></body></text></TEI>',
    );
    let call = 0;
    const client = new FakeClient(() => {
      call++;
      if (call === 1) {
        return JSON.stringify({
          suggestions: [
            { surface: '張衡', occurrence: 1, tag: 'persName', action: 'add', confidence: 0.9, rationale: 'name' },
            { surface: '洛陽', occurrence: 1, tag: 'placeName', action: 'add', confidence: 0.9, rationale: 'place' },
          ],
        });
      }
      return JSON.stringify({ suggestions: [] });
    });

    const report = await runAuditValidationHarness(doc, {
      policy: 'ignore',
      tags: ['persName', 'placeName'],
      client,
    });
    expect(report.afterSuggest.overall).toMatchObject({ tp: 2, fp: 0, fn: 0 });
    expect(report.overall).toMatchObject({ tp: 2, fp: 0, fn: 0 });
    expect(report.auditSuggestionCount).toBe(0);
  });

  it('applies audit corrections that improve suggest output', async () => {
    const doc = parse('<TEI><text><body><p><persName>張衡</persName>與<placeName>洛陽</placeName></p></body></text></TEI>');
    let call = 0;
    const client = new FakeClient(() => {
      call++;
      if (call === 1) {
        return JSON.stringify({
          suggestions: [
            { surface: '張衡', occurrence: 1, tag: 'persName', action: 'add', confidence: 0.9, rationale: 'name' },
            { surface: '洛陽', occurrence: 1, tag: 'persName', action: 'add', confidence: 0.7, rationale: 'wrong' },
          ],
        });
      }
      if (call === 2) {
        return JSON.stringify({
          suggestions: [
            { surface: '洛陽', occurrence: 1, tag: 'placeName', action: 'retag', confidence: 0.9, rationale: 'place' },
          ],
        });
      }
      return JSON.stringify({ suggestions: [] });
    });

    const report = await runAuditValidationHarness(doc, {
      policy: 'ignore',
      tags: ['persName', 'placeName'],
      client,
    });
    expect(report.afterSuggest.wrongTag).toHaveLength(1);
    expect(report.overall).toMatchObject({ tp: 2, fp: 0, fn: 0 });
    expect(report.auditSuggestionCount).toBe(1);
  });
});

describe('goldMentionsForAutoCorpus', () => {
  it('filters gold mentions whose occurrence is absent in auto text', () => {
    const manual = parse(
      '<TEI><text><body><p><persName>甲</persName>與<persName>乙</persName></p></body></text></TEI>',
    );
    const auto = parse('<TEI><text><body><p><persName>甲</persName>一人</p></body></text></TEI>');
    const { gold, corpusTextMatch, goldSkipped } = goldMentionsForAutoCorpus(manual, auto, 'ignore', [
      'persName',
    ]);
    expect(corpusTextMatch).toBe(false);
    expect(goldSkipped).toBe(1);
    expect(gold).toEqual([{ tag: 'persName', surface: '甲', occurrence: 1 }]);
  });
});

describe('runManualAutoAuditHarness', () => {
  it('scores auto input before and after audit against manual gold', async () => {
    const manual = parse(
      '<TEI><text><body><p><persName>張衡</persName>與<placeName>洛陽</placeName></p></body></text></TEI>',
    );
    const auto = parse(
      '<TEI><text><body><p><persName>張衡</persName>與<persName>洛陽</persName></p></body></text></TEI>',
    );
    let call = 0;
    const client = new FakeClient(() => {
      call++;
      if (call === 1) {
        return JSON.stringify({
          suggestions: [
            { surface: '洛陽', occurrence: 1, tag: 'placeName', action: 'retag', confidence: 0.9, rationale: 'place' },
          ],
        });
      }
      return JSON.stringify({ suggestions: [] });
    });

    const report = await runManualAutoAuditHarness(manual, auto, {
      policy: 'ignore',
      tags: ['persName', 'placeName'],
      client,
    });
    expect(report.corpusTextMatch).toBe(true);
    expect(report.beforeAudit.wrongTag).toHaveLength(1);
    expect(report.overall).toMatchObject({ tp: 2, fp: 0, fn: 0 });
    expect(report.auditSuggestionCount).toBe(1);
  });
});
