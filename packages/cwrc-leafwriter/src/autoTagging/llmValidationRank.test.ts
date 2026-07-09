import type { LlmClient, LlmRequest, LlmResponse } from './llmClient';
import { validateSuggestions } from './llmValidationRank';
import type { Suggestion } from './types';

class FakeClient implements LlmClient {
  modelId = 'fake:validation';

  constructor(private readonly responder: (req: LlmRequest) => string) {}

  async complete(req: LlmRequest): Promise<LlmResponse> {
    return {
      json: this.responder(req),
      usage: { inputTokens: 1, outputTokens: 1 },
    };
  }
}

const makeSuggestion = (id: string, tag: string): Suggestion => ({
  id,
  source: 'ai',
  action: 'add',
  tag,
  status: 'pending',
  anchor: {
    documentId: 'doc',
    xpath: '/TEI/text/body/p[1]/text()[1]',
    offset: 0,
    surface: '內史',
    occurrence: 1,
    contextBefore: '拜為',
    contextAfter: '，尋遷',
    nodeHash: 'hash',
  },
  confidence: 0.6,
});

describe('validateSuggestions', () => {
  it('scores same-span alternatives independently and ignores preferredTag', async () => {
    const client = new FakeClient(() =>
      JSON.stringify({
        validations: [
          {
            id: 'role',
            confidence: 0.82,
            recommended: true,
            preferredTag: 'roleName',
            rationale: 'office title in context',
          },
          {
            id: 'place',
            confidence: 0.31,
            recommended: false,
            preferredTag: 'roleName',
            warning: 'less likely as a place here',
            rationale: 'office reading is stronger',
          },
        ],
      }),
    );

    const result = await validateSuggestions({
      suggestions: [makeSuggestion('role', 'roleName'), makeSuggestion('place', 'placeName')],
      client,
      batchSize: 10,
    });

    expect(result.get('role')).toMatchObject({
      confidence: 0.82,
      recommended: true,
      rationale: 'office title in context',
    });
    expect(result.get('place')).toMatchObject({
      confidence: 0.31,
      recommended: false,
      warning: 'less likely as a place here',
      rationale: 'office reading is stronger',
    });
    expect(result.get('role')).not.toHaveProperty('preferredTag');
    expect(result.get('place')).not.toHaveProperty('preferredTag');
  });
});
