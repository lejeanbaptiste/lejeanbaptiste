import {
  createLlmClientFromSettings,
  isAiSuggestReady,
  isLocalAiBaseUrl,
  normalizeLlmChatBaseUrl,
} from './llmClientFromSettings';

describe('llmClientFromSettings', () => {
  it('strips trailing /v1 for MistralLlmClient', () => {
    expect(normalizeLlmChatBaseUrl('http://localhost:1234/v1')).toBe('http://localhost:1234');
    expect(normalizeLlmChatBaseUrl('https://api.groq.com/openai/v1/')).toBe('https://api.groq.com/openai');
  });

  it('detects local base URLs', () => {
    expect(isLocalAiBaseUrl('http://localhost:1234/v1')).toBe(true);
    expect(isLocalAiBaseUrl('https://api.groq.com/openai')).toBe(false);
  });

  it('requires model and base URL', () => {
    expect(isAiSuggestReady(null)).toBe(false);
    expect(isAiSuggestReady({ apiKey: '', baseUrl: '', model: '' })).toBe(false);
    expect(
      isAiSuggestReady({ apiKey: '', baseUrl: 'http://localhost:1234/v1', model: 'test' }),
    ).toBe(true);
  });

  it('requires API key for hosted endpoints', () => {
    expect(
      isAiSuggestReady({ apiKey: '', baseUrl: 'https://api.groq.com/openai', model: 'qwen/qwen3.6-27b' }),
    ).toBe(false);
    expect(
      isAiSuggestReady({ apiKey: 'gsk_x', baseUrl: 'https://api.groq.com/openai', model: 'qwen/qwen3.6-27b' }),
    ).toBe(true);
  });

  it('builds a client from settings', () => {
    const client = createLlmClientFromSettings(
      {
        apiKey: 'gsk_test',
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'qwen/qwen3.6-27b',
      },
      async () => ({ ok: true, status: 200, text: async () => '{}' }) as Response,
    );
    expect(client.modelId).toBe('mistral:qwen/qwen3.6-27b');
  });
});
