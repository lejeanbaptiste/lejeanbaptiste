import {
  languageToolCheckUrl,
  languageToolLanguagesUrl,
  mapToLanguageToolLanguage,
  normalizeLanguageToolBaseUrl,
  parseLanguageToolCheckResponse,
  type LanguageToolCheckResult,
  type LanguageToolConnectionResult,
  type LanguageToolMatch,
} from './languageTool';

export interface LanguageToolCheckRequest {
  text: string;
  language?: string | null;
}

const postForm = async (url: string, fields: Record<string, string>): Promise<Response> => {
  const body = new URLSearchParams(fields);
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
};

export const testLanguageToolConnection = async (
  baseUrl: string,
): Promise<LanguageToolConnectionResult> => {
  const origin = normalizeLanguageToolBaseUrl(baseUrl);
  try {
    const languagesUrl = languageToolLanguagesUrl(origin);
    const response = await fetch(languagesUrl, { method: 'GET' });
    if (response.ok) {
      const payload = (await response.json()) as unknown;
      const languageCount = Array.isArray(payload) ? payload.length : undefined;
      return { ok: true, languageCount };
    }

    // Some minimal servers omit /v2/languages — fall back to a tiny check.
    const check = await checkLanguageToolText(origin, {
      text: 'This is an test.',
      language: 'en-US',
    });
    if (check.ok) return { ok: true, languageCount: 0 };
    return {
      ok: false,
      error: check.error ?? `LanguageTool responded with HTTP ${response.status}.`,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Could not reach the LanguageTool server.',
    };
  }
};

export const checkLanguageToolText = async (
  baseUrl: string,
  request: LanguageToolCheckRequest,
): Promise<LanguageToolCheckResult> => {
  const text = request.text ?? '';
  if (!text.trim()) {
    return { ok: true, matches: [] };
  }

  const origin = normalizeLanguageToolBaseUrl(baseUrl);
  const language = mapToLanguageToolLanguage(request.language);

  try {
    const response = await postForm(languageToolCheckUrl(origin), {
      text,
      language,
      enabledOnly: 'false',
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return {
        ok: false,
        error:
          detail.trim() ||
          `LanguageTool check failed (HTTP ${response.status}). Is the server running at ${origin}?`,
      };
    }

    const payload = (await response.json()) as unknown;
    const parsed = parseLanguageToolCheckResponse(payload);
    return {
      ok: true,
      matches: parsed.matches,
      language: parsed.language,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : `Could not reach LanguageTool at ${origin}.`,
    };
  }
};

export type { LanguageToolMatch };
