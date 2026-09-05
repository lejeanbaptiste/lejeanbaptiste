/**
 * LanguageTool helpers shared by the desktop main process and unit tests.
 * HTTP lives in languageToolClient.ts; this file stays fetch-free for Jest.
 */

export interface LanguageToolSettings {
  /** Master switch: show Check UI and allow IPC checks. */
  enabled: boolean;
  /** Server origin when not using managed install, e.g. http://localhost:8010. */
  baseUrl: string;
  verifiedAt: string | null;
  verifiedBaseUrl: string;
  /** onDemand = Check button only; live = debounce while typing. */
  checkMode: 'onDemand' | 'live';
  /** Prefer the Grognard-managed server under userData when installed. */
  managedInstall: boolean;
  /** Pass --languageModel when English n-grams are installed. */
  ngramsEnabled: boolean;
  /** Last managed install version recorded in prefs (mirror of install.json). */
  installedVersion: string | null;
}

export interface LanguageToolMatch {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: string[];
  ruleId?: string;
}

export interface LanguageToolCheckResult {
  ok: boolean;
  error?: string;
  matches?: LanguageToolMatch[];
  language?: string;
}

export interface LanguageToolConnectionResult {
  ok: boolean;
  error?: string;
  languageCount?: number;
}

export const DEFAULT_LANGUAGE_TOOL_SETTINGS: LanguageToolSettings = {
  enabled: false,
  baseUrl: 'http://localhost:8010',
  verifiedAt: null,
  verifiedBaseUrl: '',
  checkMode: 'onDemand',
  managedInstall: false,
  ngramsEnabled: false,
  installedVersion: null,
};

/** Map short translation codes to LanguageTool language tags. */
const LANGUAGE_MAP: Record<string, string> = {
  auto: 'auto',
  de: 'de-DE',
  en: 'en-US',
  'en-gb': 'en-GB',
  'en-us': 'en-US',
  es: 'es',
  fr: 'fr',
  it: 'it',
  nl: 'nl',
  pt: 'pt',
  'pt-br': 'pt-BR',
  'pt-pt': 'pt-PT',
  pl: 'pl-PL',
  ru: 'ru-RU',
  ca: 'ca-ES',
  uk: 'uk-UA',
  sv: 'sv',
  da: 'da-DK',
  el: 'el-GR',
  ro: 'ro-RO',
  sk: 'sk-SK',
  sl: 'sl-SI',
  gl: 'gl-ES',
  ja: 'ja-JP',
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-tw': 'zh-TW',
};

export const sanitizeLanguageToolSettings = (
  value: Partial<LanguageToolSettings> | undefined,
): LanguageToolSettings => ({
  enabled: value?.enabled === true,
  baseUrl:
    typeof value?.baseUrl === 'string' && value.baseUrl.trim()
      ? value.baseUrl.trim().replace(/\/+$/, '')
      : DEFAULT_LANGUAGE_TOOL_SETTINGS.baseUrl,
  verifiedAt: typeof value?.verifiedAt === 'string' ? value.verifiedAt : null,
  verifiedBaseUrl:
    typeof value?.verifiedBaseUrl === 'string'
      ? value.verifiedBaseUrl.trim().replace(/\/+$/, '')
      : '',
  checkMode: value?.checkMode === 'live' ? 'live' : 'onDemand',
  managedInstall: value?.managedInstall === true,
  ngramsEnabled: value?.ngramsEnabled === true,
  installedVersion:
    typeof value?.installedVersion === 'string' && value.installedVersion.trim()
      ? value.installedVersion.trim()
      : null,
});

/** Base URL used for checks: managed loopback port, else user BYO URL. */
export const resolveLanguageToolCheckBaseUrl = (
  settings: LanguageToolSettings,
  managedPort = 8010,
): string => {
  if (settings.managedInstall) {
    return `http://127.0.0.1:${managedPort}`;
  }
  return normalizeLanguageToolBaseUrl(settings.baseUrl);
};

/** Normalize a user-entered base URL to the origin used for /v2/* calls. */
export const normalizeLanguageToolBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_LANGUAGE_TOOL_SETTINGS.baseUrl;
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `http://${trimmed}`);
    // Drop a trailing /v2 or /v2/check if the user pasted a full endpoint.
    let pathname = url.pathname.replace(/\/+$/, '');
    if (pathname.endsWith('/v2/check')) pathname = pathname.slice(0, -'/v2/check'.length);
    else if (pathname.endsWith('/v2')) pathname = pathname.slice(0, -'/v2'.length);
    url.pathname = pathname || '';
    url.search = '';
    url.hash = '';
    const out = url.toString().replace(/\/+$/, '');
    return out;
  } catch {
    return DEFAULT_LANGUAGE_TOOL_SETTINGS.baseUrl;
  }
};

export const languageToolCheckUrl = (baseUrl: string): string =>
  `${normalizeLanguageToolBaseUrl(baseUrl)}/v2/check`;

export const languageToolLanguagesUrl = (baseUrl: string): string =>
  `${normalizeLanguageToolBaseUrl(baseUrl)}/v2/languages`;

export const mapToLanguageToolLanguage = (code: string | null | undefined): string => {
  if (!code || !code.trim()) return 'auto';
  const normalized = code.trim().replace('_', '-');
  const lower = normalized.toLowerCase();
  if (LANGUAGE_MAP[lower]) return LANGUAGE_MAP[lower]!;
  const short = lower.split('-')[0]!;
  if (LANGUAGE_MAP[short]) return LANGUAGE_MAP[short]!;
  // Pass through tags LanguageTool may already understand.
  return normalized;
};

export const applyLanguageToolReplacement = (
  text: string,
  offset: number,
  length: number,
  replacement: string,
): string => {
  if (offset < 0 || length < 0 || offset + length > text.length) {
    throw new Error('LanguageTool replacement is out of range for the current text.');
  }
  return text.slice(0, offset) + replacement + text.slice(offset + length);
};

/** Shift later matches after an earlier replacement (apply from the list top-down). */
export const shiftLanguageToolMatchesAfterApply = (
  matches: LanguageToolMatch[],
  appliedOffset: number,
  appliedLength: number,
  replacementLength: number,
): LanguageToolMatch[] => {
  const delta = replacementLength - appliedLength;
  return matches
    .filter((match) => match.offset !== appliedOffset || match.length !== appliedLength)
    .map((match) => {
      if (match.offset >= appliedOffset + appliedLength) {
        return { ...match, offset: match.offset + delta };
      }
      // Overlapping / nested — drop; caller should re-check.
      if (
        match.offset + match.length > appliedOffset &&
        match.offset < appliedOffset + appliedLength
      ) {
        return null;
      }
      return match;
    })
    .filter((match): match is LanguageToolMatch => match !== null);
};

const LATIN_NAME_RE = /^[\p{Script=Latin}\p{M}'’.\-·\s]+$/u;

export const isLatinScriptName = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 120) return false;
  return LATIN_NAME_RE.test(trimmed);
};

export const isLatnLanguageTag = (lang: string | null | undefined): boolean => {
  if (!lang) return false;
  const lower = lang.toLowerCase();
  return lower.includes('latn') || /^(en|fr|de|es|it|nl|pt|pl|la)([-_]|$)/i.test(lower);
};

/** Collect unique latin-script tokens from entity name rows for LT post-filtering. */
export const collectLanguageToolWhitelist = (
  names: { text?: string | null; language?: string | null }[],
  cap = 5000,
): Set<string> => {
  const out = new Set<string>();
  for (const name of names) {
    const text = name.text?.trim();
    if (!text) continue;
    const keep = isLatnLanguageTag(name.language) || isLatinScriptName(text);
    if (!keep) continue;
    out.add(text);
    out.add(text.toLocaleLowerCase('en-US'));
    if (out.size >= cap) break;
  }
  return out;
};

export const matchedSpan = (
  text: string,
  match: Pick<LanguageToolMatch, 'offset' | 'length'>,
): string => text.slice(match.offset, match.offset + match.length);

/**
 * Drop matches whose exact span is a whitelisted entity romanisation / latin name
 * (case-sensitive or case-folded).
 */
export const filterLanguageToolMatchesByWhitelist = (
  text: string,
  matches: LanguageToolMatch[],
  whitelist: Set<string>,
): LanguageToolMatch[] => {
  if (whitelist.size === 0) return matches;
  return matches.filter((match) => {
    const span = matchedSpan(text, match);
    if (!span) return true;
    if (whitelist.has(span)) return false;
    if (whitelist.has(span.toLocaleLowerCase('en-US'))) return false;
    return true;
  });
};

export const parseLanguageToolCheckResponse = (
  payload: unknown,
): { matches: LanguageToolMatch[]; language?: string } => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('LanguageTool returned an empty response.');
  }
  const body = payload as {
    language?: { code?: string; name?: string };
    matches?: {
      message?: string;
      shortMessage?: string;
      offset?: number;
      length?: number;
      replacements?: { value?: string }[];
      rule?: { id?: string };
    }[];
  };

  const matches: LanguageToolMatch[] = (body.matches ?? [])
    .filter(
      (match) =>
        typeof match.offset === 'number' &&
        typeof match.length === 'number' &&
        match.length >= 0 &&
        match.offset >= 0,
    )
    .map((match) => ({
      message: typeof match.message === 'string' ? match.message : 'Suggestion',
      shortMessage:
        typeof match.shortMessage === 'string' && match.shortMessage
          ? match.shortMessage
          : typeof match.message === 'string'
            ? match.message
            : 'Suggestion',
      offset: match.offset!,
      length: match.length!,
      replacements: (match.replacements ?? [])
        .map((item) => item.value)
        .filter((value): value is string => typeof value === 'string')
        .slice(0, 5),
      ruleId: match.rule?.id,
    }));

  return {
    matches,
    language: body.language?.code,
  };
};
