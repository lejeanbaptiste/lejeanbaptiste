/**
 * ID-based crosswalk for dynasty/state nationalities, backed by the curated
 * table in `dynastyCrosswalkData.ts`. CBDB, DILA, and Wikidata each assert a
 * person's nationality with their own dynasty id and their own label text —
 * unlike persons, there was previously no shared id tying "CBDB dynasty 26"
 * to "Wikidata Q320930" to "DILA dynasty 35", so the same real-world dynasty
 * could show up as several unmerged rows under different label spellings
 * (e.g. CBDB's "三國魏" next to a Wikidata label for the same state).
 *
 * This module resolves an assertion's (source, ref) — or, failing that, its
 * raw label — to the curated table's preferred label, which doubles as the
 * canonical grouping key: two assertions that resolve to the same preferred
 * label are the same dynasty, however differently each source spelled it.
 */

import { DYNASTY_CROSSWALK, type DynastyCrosswalkEntry } from './dynastyCrosswalkData';

const byCbdbId = new Map<string, DynastyCrosswalkEntry>();
const byDilaId = new Map<string, DynastyCrosswalkEntry>();
const byWikidataQid = new Map<string, DynastyCrosswalkEntry>();
const byLabel = new Map<string, DynastyCrosswalkEntry>();

// The curated CSV has a handful of ids (cbdb/dila/wikidata) reused across more
// than one row — e.g. Wikidata Q320930 is listed for both 三國魏 and 北魏. Keep
// only the first row's mapping for a given id so lookups are at least stable,
// rather than silently depending on array order.
function setIfAbsent<K>(map: Map<K, DynastyCrosswalkEntry>, key: K, entry: DynastyCrosswalkEntry): void {
  if (!map.has(key)) map.set(key, entry);
}

for (const entry of DYNASTY_CROSSWALK) {
  for (const id of entry.cbdbIds) setIfAbsent(byCbdbId, id, entry);
  for (const id of entry.dilaIds) setIfAbsent(byDilaId, id, entry);
  for (const qid of entry.wikidataQids) setIfAbsent(byWikidataQid, qid.toUpperCase(), entry);
  setIfAbsent(byLabel, entry.label, entry);
}

/** Extracts a bare Wikidata QID from either a full entity URI or a bare "Q123" string. */
function extractWikidataQid(ref: string): string | null {
  const match = ref.match(/(Q\d+)\s*$/i);
  return match ? match[1]!.toUpperCase() : null;
}

/** Looks up the curated row for a nationality assertion by its source authority and ref (idno-style canonical id). */
function lookupDynastyEntry(
  source: string | null | undefined,
  ref: string | null | undefined,
): DynastyCrosswalkEntry | undefined {
  const normalizedSource = source?.split(':')[0]?.trim().toUpperCase();
  const trimmedRef = ref?.trim();
  if (!normalizedSource || !trimmedRef) return undefined;
  switch (normalizedSource) {
    case 'CBDB':
      return byCbdbId.get(trimmedRef);
    case 'DILA':
      return byDilaId.get(trimmedRef);
    case 'WIKIDATA': {
      const qid = extractWikidataQid(trimmedRef);
      return qid ? byWikidataQid.get(qid) : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Canonical label for a nationality assertion: the curated table's preferred
 * label when the assertion's (source, ref) resolves to a known dynasty,
 * else a same-text fallback lookup by label, else the raw label unchanged.
 * This value doubles as the grouping key — two assertions resolving to the
 * same string are the same dynasty.
 */
export function canonicalNationalityLabel(
  source: string | null | undefined,
  ref: string | null | undefined,
  rawLabel: string,
): string {
  const trimmed = rawLabel.trim();
  const byId = lookupDynastyEntry(source, ref);
  if (byId) return byId.label;
  return byLabel.get(trimmed)?.label ?? trimmed;
}
