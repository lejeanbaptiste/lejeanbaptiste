import {
  resolveLiveApiKey,
  resolveLiveBaseUrl,
  resolveLiveClientConfig,
  resolveLiveModel,
} from './liveTestEnv';

describe('liveTestEnv', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.LLM_LIVE_BASE_URL;
    delete process.env.LLM_LIVE_PROVIDER;
    delete process.env.LLM_LIVE_MODEL;
    delete process.env.LLM_LIVE_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.MISTRAL_API_KEY;
  });

  afterAll(() => {
    process.env = env;
  });

  it('auto-detects Groq when only GROQ_API_KEY is set', () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    expect(resolveLiveBaseUrl()).toBe('https://api.groq.com/openai');
    expect(resolveLiveModel(resolveLiveBaseUrl())).toBe('qwen/qwen3.6-27b');
    expect(resolveLiveApiKey(resolveLiveBaseUrl())).toEqual({ key: 'gsk_test', source: 'GROQ_API_KEY' });
  });

  it('auto-detects Mistral when only MISTRAL_API_KEY is set', () => {
    process.env.MISTRAL_API_KEY = 'mistral_test';
    expect(resolveLiveBaseUrl()).toBe('https://api.mistral.ai');
    expect(resolveLiveModel(resolveLiveBaseUrl())).toBe('ministral-8b-2512');
  });

  it('respects explicit LLM_LIVE_BASE_URL over key inference', () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    process.env.LLM_LIVE_BASE_URL = 'https://api.mistral.ai';
    expect(resolveLiveBaseUrl()).toBe('https://api.mistral.ai');
  });

  it('defaults to Groq when both API keys are set and no model hint', () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    process.env.MISTRAL_API_KEY = 'mistral_test';
    expect(resolveLiveBaseUrl()).toBe('https://api.groq.com/openai');
  });

  it('infers Mistral from LLM_LIVE_MODEL when both API keys are set', () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    process.env.MISTRAL_API_KEY = 'mistral_test';
    process.env.LLM_LIVE_MODEL = 'ministral-8b-2512';
    expect(resolveLiveBaseUrl()).toBe('https://api.mistral.ai');
  });

  it('infers local LM Studio from mistralai/ model path', () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    process.env.MISTRAL_API_KEY = 'mistral_test';
    process.env.LLM_LIVE_MODEL = 'mistralai/ministral-3-8b';
    expect(resolveLiveBaseUrl()).toBe('http://localhost:1234');
  });

  it('defaults to local when no keys or base URL are set', () => {
    expect(resolveLiveBaseUrl()).toBe('http://localhost:1234');
  });

  it('bundles baseUrl, model, and key', () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    expect(resolveLiveClientConfig()).toEqual({
      baseUrl: 'https://api.groq.com/openai',
      model: 'qwen/qwen3.6-27b',
      key: 'gsk_test',
      keySource: 'GROQ_API_KEY',
    });
  });
});
