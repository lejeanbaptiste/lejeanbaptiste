/** Shared with the Word add-in's display rules (wordprocessor/src/entityDisplay.ts). */

import type { EntityKind } from '../../autoTagging/entities';

export type { EntityKind };

export interface EntityDates {
  startYear: number | null;
  endYear: number | null;
  startPrecision: string | null;
  endPrecision: string | null;
}

export interface EntityNameEntry {
  lang: string | null;
  text: string;
  /** `primary` | `romanization` | `variant` | person name types, etc. */
  type?: string | null;
  /** `family` | `given` | `primary` | `courtesy` | … from SQLite `name_role`. */
  role?: string | null;
}

/** Vernacular gloss for a target language (fr/en/…), from entity_translations. */
export interface EntityTranslationEntry {
  lang: string;
  text: string;
}

export interface EntitySummary {
  id: string;
  kind: EntityKind;
  names: EntityNameEntry[];
  primaryName: string | null;
  romanizedName: string | null;
  /** Target-language glosses (not romanizations). */
  translations: EntityTranslationEntry[];
  description: string | null;
  dates: EntityDates | null;
  familyName: string | null;
  authorityIds: { type: string | null; value: string }[];
  /** Office kind only: first active `office_classifications` label, semantics undocumented
   * upstream (likely a CBDB office-category code) — surfaced as-is, no interpretation applied. */
  classification: string | null;
  /** Work kind only: 'book' | 'chapter' | 'poem' | 'painting' | 'object'. Drives citation styling. */
  workType: string | null;
}

/** Loose shape returned by `entitySqliteGet` / panel summaries. */
export interface SqlitePanelLike {
  id: string;
  kind: string;
  description: string | null;
  familyName: string | null;
  startYear: number | null;
  endYear: number | null;
  workDate?: {
    startYear: number | null;
    endYear: number | null;
    startPrecision: string | null;
    endPrecision: string | null;
  } | null;
  names: {
    text: string;
    language: string | null;
    nameType?: string | null;
    nameRole?: string | null;
    status?: string | null;
  }[];
  translations?: {
    text: string;
    language: string;
    status?: string | null;
  }[];
  assertions?: {
    element: string;
    status?: string | null;
    whenPrecision?: string | null;
  }[];
  authorities?: { type: string | null; value: string }[];
  classification?: string | null;
  workType?: string | null;
}

const datesFromPanel = (panel: SqlitePanelLike): EntityDates | null => {
  // Works always use workDate; persons use it when it is a floruit range (CBDB fl. earliest–latest).
  if (panel.workDate && (panel.kind === 'work' || panel.workDate.startPrecision === 'fl.')) {
    const { startYear, endYear, startPrecision, endPrecision } = panel.workDate;
    if (startYear == null && endYear == null) return null;
    return { startYear, endYear, startPrecision, endPrecision };
  }
  const birth = panel.assertions?.find((a) => a.element === 'birth' && a.status === 'active');
  const death = panel.assertions?.find((a) => a.element === 'death' && a.status === 'active');
  if (birth || death || panel.startYear != null || panel.endYear != null) {
    return {
      startYear: panel.startYear,
      endYear: panel.endYear,
      startPrecision: birth?.whenPrecision ?? null,
      endPrecision: death?.whenPrecision ?? null,
    };
  }
  return null;
};

/** True when an xml:lang tag marks Latin-script (romanized) form. */
const isLatnLanguage = (lang: string | null | undefined): boolean =>
  !!lang && /(^|-)Latn($|-)/i.test(lang);

/** Latin letters without CJK — used when romanizations were saved under zh-Hant by mistake. */
const looksLikeRomanizationText = (text: string): boolean =>
  /[A-Za-z\u00C0-\u024F]/.test(text) && !/[\u3400-\u9FFF]/.test(text);

/**
 * Pick the romanized display name from panel rows.
 * Prefer `nameType: 'romanization'`, then a proper `*-Latn` language tag, then
 * Latin-script rows that were mis-tagged as Chinese (legacy place imports).
 */
export const pickRomanizedFromPanelNames = (names: SqlitePanelLike['names']): string | null => {
  const byType = names.find((name) => name.nameType === 'romanization' && name.text?.trim());
  if (byType?.text?.trim()) return byType.text.trim();

  const byLang = names.find((name) => isLatnLanguage(name.language) && name.text?.trim());
  if (byLang?.text?.trim()) return byLang.text.trim();

  const misTagged = names.find((name) => {
    if (!name.text?.trim() || !looksLikeRomanizationText(name.text)) return false;
    const primary = (name.language ?? '').trim().toLowerCase().split(/[-_]/)[0] ?? '';
    // Empty / Chinese / und — not fr/en gloss languages.
    return !primary || primary === 'zh' || primary === 'und' || primary === 'lzh';
  });
  return misTagged?.text?.trim() || null;
};

export const summaryFromSqlitePanel = (panel: SqlitePanelLike): EntitySummary => {
  const activeNames = panel.names.filter((name) => !name.status || name.status === 'active');
  // Names list may include merged translation rows for the editor; ignore them for primary.
  const nameOnly = activeNames.filter((name) => name.nameType !== 'translation');
  const primary =
    nameOnly.find((name) => name.nameType === 'primary' || name.nameRole === 'primary') ??
    nameOnly[0] ??
    activeNames[0];
  const fromTable = (panel.translations ?? [])
    .filter((row) => !row.status || row.status === 'active')
    .map((row) => ({ lang: row.language, text: row.text }));
  const fromNames = activeNames
    .filter((name) => name.nameType === 'translation' && name.language && name.text?.trim())
    .map((name) => ({ lang: name.language!, text: name.text }));
  // Union by language: dedicated table wins on conflict, names fill gaps
  // (legacy rows, or editor merges that only appear in one place).
  const translationsByLang = new Map<string, EntityTranslationEntry>();
  for (const entry of [...fromNames, ...fromTable]) {
    const lang = (entry.lang ?? '').trim();
    const text = entry.text?.trim();
    if (!lang || !text) continue;
    translationsByLang.set(lang.toLowerCase().split(/[-_]/)[0]!, { lang, text });
  }
  const translations = [...translationsByLang.values()];
  return {
    id: panel.id,
    kind: panel.kind as EntityKind,
    names: activeNames.map((name) => ({
      lang: name.language,
      text: name.text,
      type: name.nameType ?? null,
      role: name.nameRole ?? null,
    })),
    primaryName: primary?.text ?? null,
    // Still scan all active names: legacy mis-tagged Latin under zh + type=translation
    // must remain pickable as romanization (pickRomanizedFromPanelNames ignores fr/en glosses).
    romanizedName: pickRomanizedFromPanelNames(activeNames),
    translations,
    description: panel.description,
    dates: datesFromPanel(panel),
    familyName: panel.familyName,
    authorityIds: (panel.authorities ?? []).map((authority) => ({
      type: authority.type,
      value: authority.value,
    })),
    classification: panel.classification ?? null,
    workType: panel.workType ?? (panel.kind === 'work' ? 'book' : null),
  };
};
