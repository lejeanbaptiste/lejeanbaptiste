import { MistralLlmClient, type FetchFn, type LlmClient } from './llmClient';

/** Shape of desktop AI API settings exposed via `window.__ljbCommonsUi`. */
export interface AiApiSettingsLike {
  apiKey: string;
  baseUrl: string;
  model: string;
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

/** True when base URL and model are set and a key is present for hosted endpoints. */
export function isAiSuggestReady(settings: AiApiSettingsLike | null | undefined): boolean {
  if (!settings) return false;
  const baseUrl = settings.baseUrl?.trim();
  const model = settings.model?.trim();
  if (!baseUrl || !model) return false;
  if (isLocalAiBaseUrl(baseUrl)) return true;
  return Boolean(settings.apiKey?.trim());
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
  };
}

export function llmClientFromDesktop(): LlmClient | null {
  const settings = aiApiSettingsFromDesktop();
  if (!isAiSuggestReady(settings)) return null;
  return createLlmClientFromSettings(settings!);
}
