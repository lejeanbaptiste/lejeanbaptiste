import type { LlmClient, LlmRequest, LlmResponse } from './llmClient';
import { llmAudit } from './llmAudit';
import { normalizeDomText } from './normalize';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

class FakeClient implements LlmClient {
  modelId = 'fake:test';
  lastUserPrompt = '';
  constructor(private readonly responder: (req: LlmRequest) => string) {}
  async complete(req: LlmRequest): Promise<LlmResponse> {
    this.lastUserPrompt = req.user;
    return { json: this.responder(req), usage: { inputTokens: 10, outputTokens: 10 } };
  }
}

describe('llmAudit', () => {
  it('renders existing tags inline so the model can see current boundaries', async () => {
    const doc = parse('<TEI><text><body><p><persName>張衡</persName>是天文學家</p></body></text></TEI>');
    const client = new FakeClient(() => JSON.stringify({ suggestions: [] }));
    await llmAudit(doc, { policy: 'ignore', tags: ['persName'], client });
    expect(client.lastUserPrompt).toContain('<persName>張衡</persName>');
  });

  it('verifies and emits a "remove" finding against an existing tagged mention', async () => {
    const doc = parse('<TEI><text><body><p><persName>張衡</persName>是天文學家</p></body></text></TEI>');
    const client = new FakeClient(() =>
      JSON.stringify({
        suggestions: [
          { surface: '張衡', occurrence: 1, tag: 'persName', action: 'remove', confidence: 0.8, rationale: 'not a person' },
        ],
      }),
    );

    const result = await llmAudit(doc, { policy: 'ignore', tags: ['persName'], client });
    expect(result.unverifiableCount).toBe(0);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({ action: 'remove', tag: 'persName', source: 'ai' });
  });

  it('verifies and emits an "add" finding for a missed mention', async () => {
    const doc = parse('<TEI><text><body><p><persName>張衡</persName>與洛陽</p></body></text></TEI>');
    const client = new FakeClient(() =>
      JSON.stringify({
        suggestions: [
          { surface: '洛陽', occurrence: 1, tag: 'placeName', action: 'add', confidence: 0.7, rationale: 'missed place' },
        ],
      }),
    );

    const result = await llmAudit(doc, { policy: 'ignore', tags: ['persName', 'placeName'], client });
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({ action: 'add', tag: 'placeName' });
  });

  it('drops an unverifiable finding rather than applying it', async () => {
    const doc = parse('<TEI><text><body><p><persName>張衡</persName>是天文學家</p></body></text></TEI>');
    const client = new FakeClient(() =>
      JSON.stringify({
        suggestions: [
          { surface: '完全編造', occurrence: 1, tag: 'persName', action: 'remove', confidence: 0.8, rationale: 'r' },
        ],
      }),
    );

    const result = await llmAudit(doc, { policy: 'ignore', tags: ['persName'], client });
    expect(result.suggestions).toEqual([]);
    expect(result.unverifiableCount).toBe(1);
  });
});
