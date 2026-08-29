import { MistralLlmClient, OllamaLlmClient, type FetchFn, type LlmClient } from './llmClient';

/** Shape of desktop AI API settings exposed via `window.__ljbCommonsUi`. */
export interface AiApiSettingsLike {
  apiKey: string;
  baseUrl: string;
  model: string;
  verifiedAt?: string | null;
  verifiedBaseUrl?: string;
  verifiedModel?: string;
  streamResults?: boolean;
  /** When true, AI curation runs unconditionally — no per-run opt-in checkbox (e.g. Disambiguate). */
  alwaysOn?: boolean;
}

/**
 * Normalize App Settings base URLs for `MistralLlmClient`, which appends
 * `/v1/chat/completions`. Settings often store `…/v1` (LM Studio, OpenAI style).
 */
export function normalizeLlmChatBaseUrl(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, '');
  if (url.endsWith('/v1')) url = url.slice(0, -3);
  return url.replace(/\/+$/, '');
}

export function isLocalAiBaseUrl(baseUrl: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(baseUrl);
}

const CONNECTION_TEST_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** True when the configured endpoint has passed a recent test for this model. */
export function isAiSuggestReady(settings: AiApiSettingsLike | null | undefined): boolean {
  if (!settings) return false;
  const baseUrl = settings.baseUrl?.trim();
  const model = settings.model?.trim();
  if (!baseUrl || !model) return false;
  if (!isLocalAiBaseUrl(baseUrl) && !settings.apiKey?.trim()) return false;
  const testedAt = settings.verifiedAt ? Date.parse(settings.verifiedAt) : Number.NaN;
  return (
    Number.isFinite(testedAt) &&
    Date.now() - testedAt < CONNECTION_TEST_TTL_MS &&
    settings.verifiedBaseUrl?.trim() === baseUrl &&
    settings.verifiedModel?.trim() === model
  );
}

/** Ollama listens on :11434 and uses /api/chat with JSON schema — not OpenAI /v1/chat/completions. */
export function isOllamaBaseUrl(baseUrl: string): boolean {
  return /:11434(?:\/|$)/i.test(baseUrl.trim());
}

export function createLlmClientFromSettings(
  settings: AiApiSettingsLike,
  fetchImpl?: FetchFn,
): LlmClient {
  const model = settings.model.trim();
  const apiKey = isLocalAiBaseUrl(settings.baseUrl) ? '' : settings.apiKey?.trim() || '';
  if (isOllamaBaseUrl(settings.baseUrl)) {
    return new OllamaLlmClient({
      baseUrl: normalizeLlmChatBaseUrl(settings.baseUrl),
      model,
      fetchImpl,
    });
  }
  const baseUrl = normalizeLlmChatBaseUrl(settings.baseUrl);
  return new MistralLlmClient({ apiKey, model, baseUrl, fetchImpl });
}

const COMMONS_UI = () =>
  (
    window as Window & {
      __ljbCommonsUi?: { aiApiSettings?: AiApiSettingsLike | null };
    }
  ).__ljbCommonsUi;

/** Read AI settings from the desktop commons bridge, if present. */
export function aiApiSettingsFromDesktop(): AiApiSettingsLike | null {
  const settings = COMMONS_UI()?.aiApiSettings;
  if (!settings) return null;
  return {
    apiKey: settings.apiKey ?? '',
    baseUrl: settings.baseUrl ?? '',
    model: settings.model ?? '',
    verifiedAt: settings.verifiedAt ?? null,
    verifiedBaseUrl: settings.verifiedBaseUrl ?? '',
    verifiedModel: settings.verifiedModel ?? '',
    streamResults: settings.streamResults === true,
    alwaysOn: settings.alwaysOn === true,
  };
}

export function llmClientFromDesktop(): LlmClient | null {
  const settings = aiApiSettingsFromDesktop();
  if (!isAiSuggestReady(settings)) return null;
  return createLlmClientFromSettings(settings!);
}
