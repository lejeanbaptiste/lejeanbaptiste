import { MistralLlmClient, type FetchFn, type LlmClient } from './llmClient';

/** Shape of desktop AI API settings exposed via `window.__ljbCommonsUi`. */
export interface AiApiSettingsLike {
  apiKey: string;
  baseUrl: string;
  model: string;
  verifiedAt?: string | null;
  verifiedBaseUrl?: string;
  verifiedModel?: string;
  streamResults?: boolean;
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

export function createLlmClientFromSettings(
  settings: AiApiSettingsLike,
  fetchImpl?: FetchFn,
): LlmClient {
  const model = settings.model.trim();
  const baseUrl = normalizeLlmChatBaseUrl(settings.baseUrl);
  const apiKey = isLocalAiBaseUrl(settings.baseUrl) ? '' : settings.apiKey?.trim() || '';
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
  };
}

export function llmClientFromDesktop(): LlmClient | null {
  const settings = aiApiSettingsFromDesktop();
  if (!isAiSuggestReady(settings)) return null;
  return createLlmClientFromSettings(settings!);
}
