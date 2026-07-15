/** Exact surface-string matching for disambiguation reconcile results. */

import { WIKIDATA_PROP_TO_NAME_TYPE, type NameTypeId } from './nameTypes';
import type { WikidataFetchFn } from './wikidataDates';

const WIKIDATA_NAME_LANGS = ['zh-hant', 'zh', 'zh-hans', 'ja', 'ko', 'bo', 'en'] as const;
const WIKIDATA_NAMES_BATCH_SIZE = 50;

interface WikidataLabelEntry {
  value?: string;
}

interface WikidataEntityNames {
  labels?: Record<string, WikidataLabelEntry>;
  aliases?: Record<string, WikidataLabelEntry[]>;
}

interface WikidataEntitiesResponse {
  entities?: Record<string, WikidataEntityNames>;
}

/** Session cache of Q-id → per-language labels (empty when entity missing). */
const wikidataLabelsCache = new Map<string, Record<string, string>>();
/** Session cache of Q-id → all known labels/aliases (empty when entity missing). */
const wikidataNamesCache = new Map<string, string[]>();

export function clearWikidataNamesCacheForTests(): void {
  wikidataNamesCache.clear();
  wikidataLabelsCache.clear();
}

/** Unicode NFC + trim; used before comparing surface forms. */
export function normalizeMatchString(value: string): string {
  return value.normalize('NFC').trim();
}

/** True when the string uses only Latin letters, marks, spaces, and common punctuation. */
export function isLatinSurface(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^[\p{Script=Latin}\p{M}\s.'-]+$/u.test(trimmed);
}

/** Exact match; Latin-only strings compare case-insensitively. */
export function stringsMatchExactly(surface: string, candidate: string): boolean {
  const left = normalizeMatchString(surface);
  const right = normalizeMatchString(candidate);
  if (!left || !right) return false;
  if (left === right) return true;
  if (isLatinSurface(left) && isLatinSurface(right)) {
    return left.toLowerCase() === right.toLowerCase();
  }
  return false;
}

function collectEntityNames(entity: WikidataEntityNames | undefined): string[] {
  if (!entity) return [];
  const names = new Set<string>();
  for (const lang of WIKIDATA_NAME_LANGS) {
    const label = entity.labels?.[lang]?.value;
    if (label) names.add(label);
    for (const alias of entity.aliases?.[lang] ?? []) {
      if (alias.value) names.add(alias.value);
    }
  }
  for (const label of Object.values(entity.labels ?? {})) {
    if (label.value) names.add(label.value);
  }
  return [...names];
}

function collectEntityLabels(entity: WikidataEntityNames | undefined): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const [lang, entry] of Object.entries(entity?.labels ?? {})) {
    if (entry.value) labels[lang.toLowerCase()] = entry.value;
  }
  return labels;
}

async function fetchWikidataNamesBatchUncached(
  qids: string[],
  fetchImpl: WikidataFetchFn,
): Promise<Map<string, { names: string[]; labels: Record<string, string> }>> {
  const out = new Map<string, { names: string[]; labels: Record<string, string> }>();
  if (qids.length === 0) return out;

  const langs = WIKIDATA_NAME_LANGS.join('|');
  const ids = qids.join('|');
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&props=labels|aliases&languages=${langs}&format=json&origin=*`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    for (const qid of qids) out.set(qid, { names: [], labels: {} });
    return out;
  }

  const data = (await response.json()) as WikidataEntitiesResponse;
  for (const qid of qids) {
    const entity = data.entities?.[qid];
    out.set(qid, { names: collectEntityNames(entity), labels: collectEntityLabels(entity) });
  }
  return out;
}

async function fetchNamesAndLabels(
  qids: string[],
  fetchImpl: WikidataFetchFn,
): Promise<void> {
  const pending = qids.filter(
    (qid) => !wikidataNamesCache.has(qid) || !wikidataLabelsCache.has(qid),
  );
  for (let i = 0; i < pending.length; i += WIKIDATA_NAMES_BATCH_SIZE) {
    const batch = pending.slice(i, i + WIKIDATA_NAMES_BATCH_SIZE);
    const fetched = await fetchWikidataNamesBatchUncached(batch, fetchImpl);
    for (const qid of batch) {
      const entry = fetched.get(qid) ?? { names: [], labels: {} };
      wikidataNamesCache.set(qid, entry.names);
      wikidataLabelsCache.set(qid, entry.labels);
    }
  }
}

/** Fetch (or read from session cache) Wikidata labels/aliases for Q-ids. */
export async function wikidataNamesByQid(
  qids: string[],
  fetchImpl: WikidataFetchFn = fetch,
): Promise<Map<string, string[]>> {
  const unique = [...new Set(qids.map((q) => q.toUpperCase()))];
  await fetchNamesAndLabels(unique, fetchImpl);
  return new Map(unique.map((qid) => [qid, wikidataNamesCache.get(qid) ?? []]));
}

/** Fetch (or read from session cache) Wikidata per-language labels for Q-ids. */
export async function wikidataLabelsByQid(
  qids: string[],
  fetchImpl: WikidataFetchFn = fetch,
): Promise<Map<string, Record<string, string>>> {
  const unique = [...new Set(qids.map((q) => q.toUpperCase()))];
  await fetchNamesAndLabels(unique, fetchImpl);
  return new Map(unique.map((qid) => [qid, wikidataLabelsCache.get(qid) ?? {}]));
}

/** Label-language fallback chains per project language. */
const LABEL_LANG_CHAINS: Record<string, string[]> = {
  'zh-hant': ['zh-hant', 'zh', 'zh-hans'],
  'zh-hans': ['zh-hans', 'zh', 'zh-hant'],
  zh: ['zh', 'zh-hant', 'zh-hans'],
  lzh: ['zh-hant', 'zh', 'zh-hans'],
  ja: ['ja'],
  ko: ['ko'],
  bo: ['bo'],
};

/** Pick the label matching the project language, following per-language fallbacks. */
export function preferredLabelForLang(
  labels: Record<string, string>,
  projectLang: string | null | undefined,
): string | null {
  if (!projectLang) return null;
  const key = projectLang.trim().toLowerCase();
  const chain = LABEL_LANG_CHAINS[key] ?? LABEL_LANG_CHAINS[key.split('-')[0]!] ?? [key];
  for (const lang of chain) {
    const label = labels[lang];
    if (label) return label;
  }
  return null;
}

export interface WikidataTypedName {
  text: string;
  type: NameTypeId;
  /** Language of the monolingual-text claim (e.g. "zh", "zh-hant"), when given. */
  lang?: string;
}

interface WikidataClaimsResponse {
  entities?: Record<
    string,
    {
      claims?: Record<
        string,
        { mainsnak?: { datavalue?: { value?: { text?: string; language?: string } } } }[]
      >;
    }
  >;
}

/** Session cache of Q-id → typed names from name-property claims. */
const wikidataTypedNamesCache = new Map<string, WikidataTypedName[]>();

export function clearWikidataTypedNamesCacheForTests(): void {
  wikidataTypedNamesCache.clear();
}

/**
 * Fetch (session-cached) the typed names Wikidata knows for these Q-ids:
 * native name (P1559), courtesy 字 (P1782), art name 號 (P1787), posthumous
 * 諡號 (P1786), temple 廟號 (P1785), pseudonym (P742), nickname (P1449) —
 * mapped onto the canonical name-type vocabulary.
 */
export async function fetchWikidataTypedNames(
  qids: string[],
  fetchImpl: WikidataFetchFn = fetch,
): Promise<Map<string, WikidataTypedName[]>> {
  const unique = [...new Set(qids.map((q) => q.toUpperCase()))];
  const pending = unique.filter((qid) => !wikidataTypedNamesCache.has(qid));

  for (let i = 0; i < pending.length; i += WIKIDATA_NAMES_BATCH_SIZE) {
    const batch = pending.slice(i, i + WIKIDATA_NAMES_BATCH_SIZE);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch.join('|')}&props=claims&format=json&origin=*`;
    let data: WikidataClaimsResponse = {};
    try {
      const response = await fetchImpl(url);
      if (response.ok) data = (await response.json()) as WikidataClaimsResponse;
    } catch {
      // offline / API failure: cache empty so a panel session doesn't retry per candidate
    }
    for (const qid of batch) {
      const names: WikidataTypedName[] = [];
      const claims = data.entities?.[qid]?.claims ?? {};
      for (const [prop, type] of Object.entries(WIKIDATA_PROP_TO_NAME_TYPE)) {
        for (const claim of claims[prop] ?? []) {
          const value = claim.mainsnak?.datavalue?.value;
          const text = value?.text?.trim();
          if (text) names.push({ text, type, lang: value?.language });
        }
      }
      wikidataTypedNamesCache.set(qid, names);
    }
  }

  return new Map(unique.map((qid) => [qid, wikidataTypedNamesCache.get(qid) ?? []]));
}

export function extractWikidataIdsFromText(text: string | undefined): string[] {
  if (!text) return [];
  const ids = new Set<string>();
  const patterns = [
    /wikidata\.org\/(?:wiki|entity)\/(Q\d+)/gi,
    /WKP\|(Q\d+)/gi,
    /\b(Q\d{3,})\b/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]) ids.add(match[1].toUpperCase());
    }
  }
  return [...ids];
}

export interface SurfaceMatchFields {
  label: string;
  description?: string;
  uri: string;
}

/** Whether a reconcile row matches the mention surface exactly (label or Wikidata name). */
export function reconcileMatchMatchesSurface(
  surface: string,
  match: SurfaceMatchFields,
  namesByQid: Map<string, string[]>,
): boolean {
  if (stringsMatchExactly(surface, match.label)) return true;

  const qids = new Set<string>([
    ...extractWikidataIdsFromText(match.uri),
    ...extractWikidataIdsFromText(match.description),
  ]);

  for (const qid of qids) {
    const names = namesByQid.get(qid) ?? [];
    if (names.some((name) => stringsMatchExactly(surface, name))) return true;
  }

  return false;
}

/** Keep only reconcile rows whose label or Wikidata names exactly match the surface. */
export async function filterReconcileByExactSurface<T extends SurfaceMatchFields>(
  matches: T[],
  surface: string,
  fetchImpl: WikidataFetchFn = fetch,
): Promise<T[]> {
  if (matches.length === 0) return matches;

  const qids = new Set<string>();
  for (const match of matches) {
    for (const qid of extractWikidataIdsFromText(match.uri)) qids.add(qid);
    for (const qid of extractWikidataIdsFromText(match.description)) qids.add(qid);
  }

  const namesByQid = await wikidataNamesByQid([...qids], fetchImpl);
  return matches.filter((match) => reconcileMatchMatchesSurface(surface, match, namesByQid));
}
