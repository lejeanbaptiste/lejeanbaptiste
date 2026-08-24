import { BrowserWindow, Menu, type WebContents } from 'electron';

export interface TranslationSpellcheckOptions {
  enabled: boolean;
  languageCodes: string[];
}

/** Prefer these dictionary tags when the project only stores a short language code. */
const LANGUAGE_CANDIDATES: Record<string, string[]> = {
  de: ['de-DE', 'de'],
  en: ['en-US', 'en-GB', 'en'],
  es: ['es-ES', 'es-419', 'es'],
  fr: ['fr-FR', 'fr'],
  it: ['it-IT', 'it'],
  nl: ['nl-NL', 'nl'],
  pt: ['pt-BR', 'pt-PT', 'pt'],
  zh: ['zh-CN', 'zh-TW', 'zh'],
};

let spellcheckEnabled = false;

const normalizeLanguageCode = (code: string): string => code.trim().replace('_', '-');

const candidatesFor = (code: string): string[] => {
  const normalized = normalizeLanguageCode(code);
  if (!normalized) return [];
  const short = normalized.split('-')[0]!.toLowerCase();
  const preferred = LANGUAGE_CANDIDATES[short] ?? [];
  // Exact code first (so pt-PT wins over pt-BR when requested), then known tags.
  return Array.from(new Set([normalized, ...preferred, short]));
};

/**
 * Pick Hunspell/OS dictionary tags that Chromium actually has installed.
 * Falls back to a preferred tag when the platform reports none available
 * (macOS sometimes returns an empty list while still using the system checker).
 */
export const resolveSpellCheckerLanguages = (
  available: string[],
  languageCodes: string[],
): string[] => {
  const availableSet = new Set(available.map((code) => code.toLowerCase()));
  const resolved: string[] = [];

  for (const code of languageCodes) {
    const match = candidatesFor(code).find((candidate) =>
      availableSet.has(candidate.toLowerCase()),
    );
    if (match && !resolved.some((existing) => existing.toLowerCase() === match.toLowerCase())) {
      resolved.push(match);
    }
  }

  if (resolved.length > 0) return resolved;

  // No installed match — prefer a known dictionary tag over the bare short code.
  for (const code of languageCodes) {
    const normalized = normalizeLanguageCode(code);
    const short = normalized.split('-')[0]?.toLowerCase() ?? '';
    const fallback = LANGUAGE_CANDIDATES[short]?.[0] ?? normalized;
    if (fallback) return [fallback];
  }

  return [];
};

export const applyTranslationSpellcheck = (
  webContents: WebContents,
  options: TranslationSpellcheckOptions,
): void => {
  spellcheckEnabled = options.enabled === true;
  const session = webContents.session;
  // Keep Chromium's checker available app-wide; the translation pane scopes
  // underlines with the contentEditable `spellCheck` attribute. Disabling the
  // session checker here would also break other spellCheck inputs.
  session.setSpellCheckerEnabled(true);

  if (options.languageCodes.length === 0) return;

  const languages = resolveSpellCheckerLanguages(
    session.availableSpellCheckerLanguages,
    options.languageCodes,
  );
  if (languages.length === 0) return;

  try {
    session.setSpellCheckerLanguages(languages);
  } catch (error) {
    // Unknown dictionary tags throw on some platforms; keep spellcheck on with
    // whatever Chromium already had configured.
    console.warn('[spellcheck] setSpellCheckerLanguages failed:', error);
  }
};

export const attachTranslationSpellcheckContextMenu = (webContents: WebContents): void => {
  webContents.on('context-menu', (_event, params) => {
    if (!spellcheckEnabled) return;
    if (!params.misspelledWord) return;

    const suggestions = params.dictionarySuggestions ?? [];
    const template: Electron.MenuItemConstructorOptions[] = suggestions.map((suggestion) => ({
      label: suggestion,
      click: () => webContents.replaceMisspelling(suggestion),
    }));

    if (suggestions.length > 0) {
      template.push({ type: 'separator' });
    }

    template.push({
      label: 'Add to dictionary',
      click: () => webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
    });

    const menu = Menu.buildFromTemplate(template);
    const window = BrowserWindow.fromWebContents(webContents) ?? undefined;
    menu.popup({ window });
  });
};
