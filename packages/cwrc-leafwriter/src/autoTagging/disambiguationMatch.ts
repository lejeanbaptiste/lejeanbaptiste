/** Exact surface-string matching for disambiguation reconcile results. */

import type { WikidataFetchFn } from './wikidataDates';

const WIKIDATA_NAME_LANGS = ['zh-hant', 'zh', 'zh-hans', 'ja', 'en'] as const;
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

/** Session cache of Q-id → all known labels/aliases (empty when entity missing). */
const wikidataNamesCache = new Map<string, string[]>();

export function clearWikidataNamesCacheForTests(): void {
  wikidataNamesCache.clear();
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

async function fetchWikidataNamesBatchUncached(
  qids: string[],
  fetchImpl: WikidataFetchFn,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (qids.length === 0) return out;

  const langs = WIKIDATA_NAME_LANGS.join('|');
  const ids = qids.join('|');
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&props=labels|aliases&languages=${langs}&format=json&origin=*`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    for (const qid of qids) out.set(qid, []);
    return out;
  }

  const data = (await response.json()) as WikidataEntitiesResponse;
  for (const qid of qids) {
    out.set(qid, collectEntityNames(data.entities?.[qid]));
  }
  return out;
}

/** Fetch (or read from session cache) Wikidata labels/aliases for Q-ids. */
export async function wikidataNamesByQid(
  qids: string[],
  fetchImpl: WikidataFetchFn = fetch,
): Promise<Map<string, string[]>> {
  const unique = [...new Set(qids.map((q) => q.toUpperCase()))];
  const out = new Map<string, string[]>();
  const pending: string[] = [];

  for (const qid of unique) {
    if (wikidataNamesCache.has(qid)) {
      out.set(qid, wikidataNamesCache.get(qid)!);
    } else {
      pending.push(qid);
    }
  }

  for (let i = 0; i < pending.length; i += WIKIDATA_NAMES_BATCH_SIZE) {
    const batch = pending.slice(i, i + WIKIDATA_NAMES_BATCH_SIZE);
    const batchNames = await fetchWikidataNamesBatchUncached(batch, fetchImpl);
    for (const qid of batch) {
      const names = batchNames.get(qid) ?? [];
      wikidataNamesCache.set(qid, names);
      out.set(qid, names);
    }
  }

  return out;
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
