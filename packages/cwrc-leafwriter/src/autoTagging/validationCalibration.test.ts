import type { LlmClient, LlmRequest, LlmResponse } from './llmClient';
import { normalizeDomText } from './normalize';
import type { AiValidationResult } from './types';
import {
  calibrationBuckets,
  confusionAtThreshold,
  labelSuggestionsAgainstGold,
  runValidationCalibrationHarness,
  sweepThresholds,
  type LabeledValidation,
} from './validationCalibration';
import { goldMentions } from './validationHarness';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

const validation = (over: Partial<AiValidationResult>): AiValidationResult => ({
  confidence: 0.5,
  recommended: true,
  ...over,
});

const labeled = (
  over: Partial<LabeledValidation> & { correct: boolean; validation: AiValidationResult },
): LabeledValidation => ({
  suggestionId: 'x',
  tag: 'persName',
  surface: '張衡',
  ...over,
});

describe('labelSuggestionsAgainstGold', () => {
  it('marks a suggestion correct only when surface, occurrence, and tag all match a gold mention', () => {
    const doc = parse(
      '<TEI><text><body><p><persName>張衡</persName>與<placeName>洛陽</placeName></p></body></text></TEI>',
    );
    const gold = goldMentions(doc, 'ignore', ['persName', 'placeName']);
    const suggestions = [
      {
        id: 'a',
        source: 'ai' as const,
        action: 'add' as const,
        tag: 'persName',
        status: 'pending' as const,
        anchor: {
          documentId: '',
          xpath: '',
          offset: 0,
          surface: '張衡',
          occurrence: 1,
          contextBefore: '',
          contextAfter: '',
          nodeHash: '',
        },
      },
      {
        id: 'b',
        source: 'ai' as const,
        action: 'add' as const,
        tag: 'roleName',
        status: 'pending' as const,
        anchor: {
          documentId: '',
          xpath: '',
          offset: 0,
          surface: '洛陽',
          occurrence: 1,
          contextBefore: '',
          contextAfter: '',
          nodeHash: '',
        },
      },
      {
        id: 'c',
        source: 'ai' as const,
        action: 'add' as const,
        tag: 'persName',
        status: 'pending' as const,
        anchor: {
          documentId: '',
          xpath: '',
          offset: 0,
          surface: '虛構',
          occurrence: 1,
          contextBefore: '',
          contextAfter: '',
          nodeHash: '',
        },
      },
    ];
    const labels = labelSuggestionsAgainstGold(gold, suggestions);
    expect(labels.get('a')).toBe(true);
    expect(labels.get('b')).toBe(false); // right span, wrong tag
    expect(labels.get('c')).toBe(false); // not in gold at all
  });
});

describe('confusionAtThreshold', () => {
  it('counts kept-and-correct as tp, kept-and-wrong as fp, dropped-and-correct as fn', () => {
    const data: LabeledValidation[] = [
      labeled({ suggestionId: 'a', correct: true, validation: validation({ confidence: 0.9 }) }),
      labeled({ suggestionId: 'b', correct: false, validation: validation({ confidence: 0.9 }) }),
      labeled({ suggestionId: 'c', correct: true, validation: validation({ confidence: 0.2 }) }),
      labeled({ suggestionId: 'd', correct: false, validation: validation({ confidence: 0.2 }) }),
    ];
    const result = confusionAtThreshold(data, 0.8);
    expect(result).toMatchObject({
      tp: 1,
      fp: 1,
      fn: 1,
      tn: 1,
      precision: 0.5,
      recall: 0.5,
      accuracy: 0.5,
    });
  });

  it('treats an empty set as perfect (no evidence of failure)', () => {
    expect(confusionAtThreshold([], 0.8)).toMatchObject({ precision: 1, recall: 1, accuracy: 1 });
  });
});

describe('sweepThresholds', () => {
  it('reports confusion at each default threshold', () => {
    const data: LabeledValidation[] = [
      labeled({ correct: true, validation: validation({ confidence: 0.6 }) }),
    ];
    const sweep = sweepThresholds(data);
    expect(sweep).toHaveLength(11);
    expect(sweep[0]!.threshold).toBe(0);
    expect(sweep.at(-1)!.threshold).toBe(1);
  });
});

describe('calibrationBuckets', () => {
  it('reports empirical accuracy per confidence bucket', () => {
    const data: LabeledValidation[] = [
      labeled({ suggestionId: 'a', correct: true, validation: validation({ confidence: 0.85 }) }),
      labeled({ suggestionId: 'b', correct: true, validation: validation({ confidence: 0.82 }) }),
      labeled({ suggestionId: 'c', correct: false, validation: validation({ confidence: 0.81 }) }),
    ];
    const buckets = calibrationBuckets(data);
    const highBucket = buckets.find((b) => b.low === 0.8)!;
    expect(highBucket.count).toBe(3);
    expect(highBucket.correctCount).toBe(2);
    expect(highBucket.accuracy).toBeCloseTo(2 / 3);
  });

  it('leaves empty buckets as NaN accuracy rather than misleadingly reporting 0', () => {
    const buckets = calibrationBuckets([]);
    expect(buckets.every((b) => Number.isNaN(b.accuracy))).toBe(true);
  });
});

class FakeClient implements LlmClient {
  modelId = 'fake:calibration';
  constructor(private readonly responder: (req: LlmRequest, call: number) => string) {}
  calls = 0;
  async complete(req: LlmRequest): Promise<LlmResponse> {
    this.calls++;
    return { json: this.responder(req, this.calls), usage: { inputTokens: 1, outputTokens: 1 } };
  }
}

describe('runValidationCalibrationHarness', () => {
  it('labels suggest output against gold, scores validation confidence, and reports calibration', async () => {
    const doc = parse(
      '<TEI><text><body><p><persName>張衡</persName>與<placeName>洛陽</placeName></p></body></text></TEI>',
    );
    let call = 0;
    const client = new FakeClient(() => {
      call++;
      if (call === 1) {
        // suggest: one correct hit, one mistagged false positive (right span, wrong requested tag)
        return JSON.stringify({
          suggestions: [
            {
              surface: '張衡',
              occurrence: 1,
              tag: 'persName',
              action: 'add',
              confidence: 0.9,
              rationale: 'name',
            },
            {
              surface: '洛陽',
              occurrence: 1,
              tag: 'persName',
              action: 'add',
              confidence: 0.6,
              rationale: 'guess',
            },
          ],
        });
      }
      // validate: correctly confident on the true one, unsure on the wrong one
      return JSON.stringify({
        validations: [
          { id: 'ai_0', confidence: 0.95, recommended: true },
          { id: 'ai_1', confidence: 0.4, recommended: false },
        ],
      });
    });

    const report = await runValidationCalibrationHarness(doc, {
      policy: 'ignore',
      tags: ['persName', 'placeName'],
      suggestClient: client,
    });

    expect(report.suggestCount).toBe(2);
    expect(report.correctCount).toBe(1);
    expect(report.incorrectCount).toBe(1);
    expect(report.atConfiguredThreshold).toMatchObject({
      threshold: 0.8,
      tp: 1,
      fp: 0,
      tn: 1,
      fn: 0,
    });
  });
});
