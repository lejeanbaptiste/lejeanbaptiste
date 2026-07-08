import { MistralLlmClient, parseRateLimitRetryMs } from './llmClient';

describe('parseRateLimitRetryMs', () => {
  it('parses Groq-style retry delay from error body', () => {
    const body =
      'Please try again in 12.96s. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing';
    expect(parseRateLimitRetryMs(body)).toBe(13_460);
  });

  it('returns null when no delay is present', () => {
    expect(parseRateLimitRetryMs('rate limit exceeded')).toBeNull();
  });
});

describe('MistralLlmClient rate-limit retry', () => {
  it('waits and retries on HTTP 429', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      if (calls === 1) {
        return {
          ok: false,
          status: 429,
          text: async () =>
            JSON.stringify({
              error: {
                message: 'Please try again in 0.01s',
                type: 'tokens',
                code: 'rate_limit_exceeded',
              },
            }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            choices: [{ message: { content: '{"suggestions":[]}' } }],
            usage: { prompt_tokens: 10, completion_tokens: 2 },
          }),
      };
    }) as unknown as typeof fetch;

    const client = new MistralLlmClient({
      apiKey: 'test',
      model: 'qwen/qwen3.6-27b',
      baseUrl: 'https://api.groq.com/openai',
      fetchImpl,
    });

    const response = await client.complete({
      system: 'test',
      user: 'chunk',
      jsonSchema: { type: 'object' },
    });

    expect(calls).toBe(2);
    expect(response.json).toContain('suggestions');
  });
});
