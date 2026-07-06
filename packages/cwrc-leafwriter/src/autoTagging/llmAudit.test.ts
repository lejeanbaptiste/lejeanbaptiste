import type { LlmClient, LlmRequest, LlmResponse } from './llmClient';
import { llmAudit, llmAuditAdd, llmAuditClean } from './llmAudit';
import { normalizeDomText } from './normalize';
import { filterNestedSameTagAdds } from './suggestionFilters';

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  normalizeDomText(doc);
  return doc;
};

class FakeClient implements LlmClient {
  modelId = 'fake:test';
  lastUserPrompt = '';
  calls = 0;
  constructor(private readonly responder: (req: LlmRequest, call: number) => string) {}
  async complete(req: LlmRequest): Promise<LlmResponse> {
    this.calls++;
    this.lastUserPrompt = req.user;
    return { json: this.responder(req, this.calls), usage: { inputTokens: 10, outputTokens: 10 } };
  }
}

describe('llmAudit', () => {
  it('renders existing tags inline on the clean pass', async () => {
    const doc = parse('<TEI><text><body><p><persName>張衡</persName>是天文學家</p></body></text></TEI>');
    const client = new FakeClient(() => JSON.stringify({ suggestions: [] }));
    await llmAuditClean(doc, { policy: 'ignore', tags: ['persName'], client });
    expect(client.lastUserPrompt).toContain('<persName>張衡</persName>');
  });

  it('verifies and emits a "remove" finding against an existing tagged mention', async () => {
    const doc = parse('<TEI><text><body><p><persName>張衡</persName>是天文學家</p></body></text></TEI>');
    const client = new FakeClient((_req, call) =>
      call === 1
        ? JSON.stringify({
            suggestions: [
              { surface: '張衡', occurrence: 1, tag: 'persName', action: 'remove', confidence: 0.8, rationale: 'not a person' },
            ],
          })
        : JSON.stringify({ suggestions: [] }),
    );

    const result = await llmAudit(doc, { policy: 'ignore', tags: ['persName'], client });
    expect(result.unverifiableCount).toBe(0);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({ action: 'remove', tag: 'persName', source: 'ai' });
    expect(result.cleanSuggestionCount).toBe(1);
  });

  it('verifies and emits an "add" finding for a missed mention', async () => {
    const doc = parse('<TEI><text><body><p><persName>張衡</persName>與洛陽</p></body></text></TEI>');
    const client = new FakeClient((_req, call) =>
      call === 1
        ? JSON.stringify({ suggestions: [] })
        : JSON.stringify({
            suggestions: [
              { surface: '洛陽', occurrence: 1, tag: 'placeName', action: 'add', confidence: 0.7, rationale: 'missed place' },
            ],
          }),
    );

    const result = await llmAudit(doc, { policy: 'ignore', tags: ['persName', 'placeName'], client });
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({ action: 'add', tag: 'placeName' });
    expect(result.addSuggestionCount).toBe(1);
  });

  it('drops an add nested inside the same tag via review filter', async () => {
    const doc = parse('<TEI><text><body><p><persName>張行成</persName>奏對</p></body></text></TEI>');
    const client = new FakeClient(() =>
      JSON.stringify({
        suggestions: [
          { surface: '行成', occurrence: 1, tag: 'persName', action: 'add', confidence: 0.8, rationale: 'anaphora' },
        ],
      }),
    );

    const raw = await llmAuditAdd(doc, { policy: 'ignore', tags: ['persName'], client });
    expect(raw.suggestions).toHaveLength(1);
    const { suggestions, dropped } = filterNestedSameTagAdds(doc, 'ignore', raw.suggestions);
    expect(suggestions).toEqual([]);
    expect(dropped).toBe(1);
  });

  it('drops an unverifiable finding rather than applying it', async () => {
    const doc = parse('<TEI><text><body><p><persName>張衡</persName>是天文學家</p></body></text></TEI>');
    const client = new FakeClient((_req, call) =>
      call === 1
        ? JSON.stringify({
            suggestions: [
              { surface: '完全編造', occurrence: 1, tag: 'persName', action: 'remove', confidence: 0.8, rationale: 'r' },
            ],
          })
        : JSON.stringify({ suggestions: [] }),
    );

    const result = await llmAudit(doc, { policy: 'ignore', tags: ['persName'], client });
    expect(result.suggestions).toEqual([]);
    expect(result.unverifiableCount).toBe(1);
  });

  it('drops a no-op retag where target tag equals the current tag', async () => {
    const doc = parse('<TEI><text><body><p><persName>張衡</persName>是天文學家</p></body></text></TEI>');
    const client = new FakeClient((_req, call) =>
      call === 1
        ? JSON.stringify({
            suggestions: [
              {
                surface: '張衡',
                occurrence: 1,
                tag: 'persName',
                action: 'retag',
                confidence: 0.8,
                rationale: 'should be regnal name not persName',
              },
            ],
          })
        : JSON.stringify({ suggestions: [] }),
    );

    const result = await llmAudit(doc, { policy: 'ignore', tags: ['persName'], client });
    expect(result.suggestions).toEqual([]);
    expect(result.unverifiableCount).toBe(1);
  });
});
