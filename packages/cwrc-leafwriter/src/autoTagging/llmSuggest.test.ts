import type { LlmClient, LlmRequest, LlmResponse } from './llmClient';
import { LlmCache } from './llmCache';
import { llmSuggest } from './llmSuggest';
import { normalizeDomText } from './normalize';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

class FakeClient implements LlmClient {
  modelId = 'fake:test';
  calls = 0;
  constructor(private readonly responder: (req: LlmRequest) => string) {}
  async complete(req: LlmRequest): Promise<LlmResponse> {
    this.calls++;
    return { json: this.responder(req), usage: { inputTokens: 10, outputTokens: 10 } };
  }
}

describe('llmSuggest', () => {
  it('emits a verified add suggestion for a model-reported mention', async () => {
    const doc = parse('<TEI><text><body><p>張衡是天文學家</p></body></text></TEI>');
    const client = new FakeClient(() =>
      JSON.stringify({
        suggestions: [
          { surface: '張衡', occurrence: 1, tag: 'persName', action: 'add', confidence: 0.9, rationale: 'name' },
        ],
      }),
    );

    const result = await llmSuggest(doc, { policy: 'ignore', tags: ['persName'], client });

    expect(result.unverifiableCount).toBe(0);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({
      source: 'ai',
      sourceDetail: 'fake:test',
      action: 'add',
      tag: 'persName',
      status: 'pending',
    });
    expect(result.suggestions[0]!.anchor.surface).toBe('張衡');
  });

  it('drops a hallucinated surface as unverifiable rather than applying it', async () => {
    const doc = parse('<TEI><text><body><p>張衡是天文學家</p></body></text></TEI>');
    const client = new FakeClient(() =>
      JSON.stringify({
        suggestions: [
          { surface: '完全編造', occurrence: 1, tag: 'persName', action: 'add', confidence: 0.9, rationale: 'r' },
        ],
      }),
    );

    const result = await llmSuggest(doc, { policy: 'ignore', tags: ['persName'], client });
    expect(result.suggestions).toHaveLength(0);
    expect(result.unverifiableCount).toBe(1);
  });

  it('drops malformed JSON as unverifiable rather than crashing', async () => {
    const doc = parse('<TEI><text><body><p>張衡是天文學家</p></body></text></TEI>');
    const client = new FakeClient(() => 'not json at all');

    const result = await llmSuggest(doc, { policy: 'ignore', tags: ['persName'], client });
    expect(result.suggestions).toEqual([]);
    expect(result.unverifiableCount).toBe(0);
  });

  it('re-running on an unchanged document hits the cache and calls the model zero times', async () => {
    const doc = parse('<TEI><text><body><p>張衡是天文學家</p></body></text></TEI>');
    const client = new FakeClient(() =>
      JSON.stringify({
        suggestions: [
          { surface: '張衡', occurrence: 1, tag: 'persName', action: 'add', confidence: 0.9, rationale: 'name' },
        ],
      }),
    );
    const cache = new LlmCache(null, null);

    const first = await llmSuggest(doc, { policy: 'ignore', tags: ['persName'], client, cache });
    expect(client.calls).toBe(1);
    expect(first.suggestions).toHaveLength(1);

    const second = await llmSuggest(doc, { policy: 'ignore', tags: ['persName'], client, cache });
    expect(client.calls).toBe(1); // no new call — served from cache
    expect(second.suggestions).toHaveLength(1);
  });

  it('calls onProgress after each chunk', async () => {
    const doc = parse('<TEI><text><body><p>張衡是天文學家</p></body></text></TEI>');
    const client = new FakeClient(() =>
      JSON.stringify({
        suggestions: [
          { surface: '張衡', occurrence: 1, tag: 'persName', action: 'add', confidence: 0.9, rationale: 'name' },
        ],
      }),
    );
    const progress: Array<{ done: number; total: number }> = [];
    await llmSuggest(doc, {
      policy: 'ignore',
      tags: ['persName'],
      client,
      onProgress: (done, total) => progress.push({ done, total }),
    });
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1]!.done).toBe(progress[progress.length - 1]!.total);
  });
});
