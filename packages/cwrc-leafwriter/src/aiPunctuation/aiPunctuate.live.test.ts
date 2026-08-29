/**
 * @jest-environment node
 *
 * Opt-in live harness for AI punctuation against Ollama/local models.
 *
 *   LLM_LIVE_TEST=1 \
 *   LLM_LIVE_BASE_URL=http://localhost:11434 \
 *   LLM_LIVE_MODEL=qwen2.5:14b \
 *   npx jest --selectProjects Core --testPathPatterns=aiPunctuate.live
 */
import { OllamaLlmClient, MistralLlmClient, type LlmClient } from '../autoTagging/llmClient';
import { hostedApiKeyHelp, resolveLiveClientConfig } from '../autoTagging/liveTestEnv';
import { llmPunctuateSegment } from './llmPunctuate';
import { stripAiPunct } from './punctSchema';

const RUN_LIVE = process.env.LLM_LIVE_TEST === '1';
const maybe = RUN_LIVE ? it : it.skip;

function buildLiveClient(baseUrl: string, model: string, apiKey: string): LlmClient {
  if (baseUrl.includes(':11434')) {
    return new OllamaLlmClient({ baseUrl, model });
  }
  return new MistralLlmClient({ apiKey: apiKey || 'not-needed', model, baseUrl });
}

/** Long enough for MIN_SEGMENT_HAN (20). */
const SAMPLE_HAN =
  '學而時習之不亦說乎有朋自遠方來不亦樂乎人不知而不慍不亦君子乎';

maybe(
  'Ollama/local model returns verifiable punctuation insertions',
  async () => {
    const { baseUrl, model, key: apiKey } = resolveLiveClientConfig();
    const needsKey =
      baseUrl.includes('api.mistral.ai') ||
      baseUrl.includes('groq.com') ||
      (!baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1'));
    if (needsKey && !apiKey) {
      throw new Error(hostedApiKeyHelp(baseUrl));
    }
    const client = buildLiveClient(baseUrl, model, apiKey);
    const result = await llmPunctuateSegment(
      { kind: 'text', han: SAMPLE_HAN, han_start: 0 },
      client,
    );
    console.log(
      `verified=${result.verified.length} dropped_schema=${result.dropped_schema} dropped_anchor=${result.dropped_anchor}`,
    );
    expect(result.verified.length).toBeGreaterThan(0);
    const rebuilt = stripAiPunct(SAMPLE_HAN);
    expect(rebuilt).toBe(SAMPLE_HAN);
    for (const ins of result.verified) {
      expect(ins.afterHan).toBeGreaterThanOrEqual(0);
      expect(ins.afterHan).toBeLessThan(SAMPLE_HAN.length);
      expect(SAMPLE_HAN[ins.afterHan]).toBeDefined();
    }
  },
  600_000,
);
