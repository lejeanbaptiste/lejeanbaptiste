/**
 * Shared env resolution for opt-in live tests (validationHarness, llmSuggest).
 * Provider-specific keys avoid sending a Groq gsk_… key to Mistral by mistake.
 */

export type LiveClientConfig = {
  baseUrl: string;
  model: string;
  key: string;
  keySource: string;
};

const GROQ_BASE = 'https://api.groq.com/openai';
const MISTRAL_BASE = 'https://api.mistral.ai';
const LOCAL_BASE = 'http://localhost:1234';

/** Guess hosted/local target from a model id (LM Studio, Groq, Mistral API). */
export function inferProviderFromModel(model: string): 'groq' | 'mistral' | 'local' | null {
  const m = model.toLowerCase();
  if (m.includes('mistralai/')) return 'local';
  if (m.startsWith('qwen/') || m.startsWith('qwen-') || m.includes('/qwen')) return 'groq';
  if (m.startsWith('moonshotai/')) return 'groq';
  if (m.startsWith('meta-llama/') || m.startsWith('llama-3')) return 'groq';
  if (m.startsWith('openai/gpt-oss')) return 'groq';
  if (m.includes('ministral') || m.startsWith('mistral-')) return 'mistral';
  return null;
}

/** Infer hosted/local base URL when LLM_LIVE_BASE_URL is not set. */
export function resolveLiveBaseUrl(): string {
  const explicit = process.env.LLM_LIVE_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const provider = process.env.LLM_LIVE_PROVIDER?.trim().toLowerCase();
  if (provider === 'groq') return GROQ_BASE;
  if (provider === 'mistral') return MISTRAL_BASE;
  if (provider === 'local') return LOCAL_BASE;

  const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());
  const hasMistral = Boolean(process.env.MISTRAL_API_KEY?.trim());
  const live = process.env.LLM_LIVE_API_KEY?.trim() ?? '';
  const modelHint = process.env.LLM_LIVE_MODEL?.trim() ?? '';

  if (modelHint) {
    const inferred = inferProviderFromModel(modelHint);
    if (inferred === 'local') return LOCAL_BASE;
    if (inferred === 'groq' && hasGroq) return GROQ_BASE;
    if (inferred === 'mistral' && hasMistral) return MISTRAL_BASE;
  }

  if (hasGroq && !hasMistral) return GROQ_BASE;
  if (hasMistral && !hasGroq) return MISTRAL_BASE;
  if (live.startsWith('gsk_')) return GROQ_BASE;
  // Both keys set and no explicit provider — default Groq (override with LLM_LIVE_PROVIDER).
  if (hasGroq && hasMistral) return GROQ_BASE;
  if (live) return MISTRAL_BASE;
  return LOCAL_BASE;
}

export function resolveLiveModel(baseUrl: string): string {
  const explicit = process.env.LLM_LIVE_MODEL?.trim();
  if (explicit) return explicit;
  if (baseUrl.includes('groq.com')) return 'qwen/qwen3.6-27b';
  if (baseUrl.includes('api.mistral.ai')) return 'ministral-8b-2512';
  return 'mistralai/ministral-3-8b';
}

/** Pick the API key that matches the target host. */
export function resolveLiveApiKey(baseUrl: string): { key: string; source: string } {
  const live = process.env.LLM_LIVE_API_KEY?.trim() ?? '';
  if (baseUrl.includes('groq.com')) {
    if (process.env.GROQ_API_KEY?.trim()) return { key: process.env.GROQ_API_KEY.trim(), source: 'GROQ_API_KEY' };
    if (live) return { key: live, source: 'LLM_LIVE_API_KEY' };
    return { key: '', source: 'none' };
  }
  if (baseUrl.includes('api.mistral.ai')) {
    if (process.env.MISTRAL_API_KEY?.trim()) return { key: process.env.MISTRAL_API_KEY.trim(), source: 'MISTRAL_API_KEY' };
    if (live.startsWith('gsk_')) {
      throw new Error(
        'LLM_LIVE_API_KEY looks like a Groq key (gsk_…), but LLM_LIVE_BASE_URL is Mistral.\n' +
          'Unset LLM_LIVE_BASE_URL to auto-detect Groq from GROQ_API_KEY, or set:\n' +
          '  LLM_LIVE_BASE_URL=https://api.groq.com/openai',
      );
    }
    if (live) return { key: live, source: 'LLM_LIVE_API_KEY' };
    return { key: '', source: 'none' };
  }
  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    return { key: '', source: 'local' };
  }
  if (live) return { key: live, source: 'LLM_LIVE_API_KEY' };
  if (process.env.MISTRAL_API_KEY?.trim()) return { key: process.env.MISTRAL_API_KEY.trim(), source: 'MISTRAL_API_KEY' };
  if (process.env.GROQ_API_KEY?.trim()) return { key: process.env.GROQ_API_KEY.trim(), source: 'GROQ_API_KEY' };
  return { key: '', source: 'none' };
}

export function resolveLiveClientConfig(): LiveClientConfig {
  const baseUrl = resolveLiveBaseUrl();
  const model = resolveLiveModel(baseUrl);
  const { key, source } = resolveLiveApiKey(baseUrl);
  return { baseUrl, model, key, keySource: source };
}

export function hostedApiKeyHelp(baseUrl?: string): string {
  const hints = [
    'Hosted API run requires an API key. Export one of:',
    '  MISTRAL_API_KEY=...   (Mistral hosted)',
    '  GROQ_API_KEY=...      (Groq — auto-detected when LLM_LIVE_BASE_URL is unset)',
    '  LLM_LIVE_PROVIDER=groq|mistral|local  (when both API keys are exported)',
    '  LLM_LIVE_MODEL=ministral-8b-2512       (infers Mistral when both keys are set)',
    '  LLM_LIVE_API_KEY=...  (override for either provider)',
    'Local LM Studio/Ollama at localhost needs no key.',
  ];
  if (baseUrl) hints.push('', `Resolved LLM_LIVE_BASE_URL: ${baseUrl}`);
  if (process.env.GROQ_API_KEY?.trim() && baseUrl?.includes('api.mistral.ai')) {
    hints.push(
      'GROQ_API_KEY is set but the run targets Mistral. Unset LLM_LIVE_BASE_URL or set LLM_LIVE_PROVIDER=groq.',
    );
  }
  if (!process.env.GROQ_API_KEY?.trim() && !process.env.MISTRAL_API_KEY?.trim() && !process.env.LLM_LIVE_API_KEY?.trim()) {
    hints.push('', 'No API keys visible to Jest. Export in the same shell before running npx jest.');
  }
  return hints.join('\n');
}
