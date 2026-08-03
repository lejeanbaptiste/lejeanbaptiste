/**
 * Precompiled VIAF ↔ Wikidata links for disambiguation collapse.
 *
 * Pack rows may carry `metadata.crosswalk.viaf` (Wikidata P214). A dedicated
 * concordance NDJSON ships the same pairs without scanning every person pack
 * on each lookup. Live LINCS rows are enriched from this index so Wikidata and
 * VIAF hits merge without scraping free-text descriptions.
 *
 * `authorityIdsFromPackCrosswalk` also maps CBDB / DILA / Norbert / … so pack
 * crosswalks collapse the same way lookupResolve's `idnosFromRow` does.
 */

import type { AuthorityId } from './entities';
import { formatNorbertAuthorityValue } from './norbertAuthorityId';
import { authorityPackLines, type AuthorityPackContent } from './packLoader';
import type { AuthorityPackId } from './packPaths';

/** Minimal candidate shape so this module does not import the panel builder. */
export interface ViafWikidataEnrichable {
  uri?: string;
  description?: string;
  authorityIds?: AuthorityId[];
}

/** Pack id for the shipped concordance sidecar. */
export const VIAF_WIKIDATA_CONCORDANCE_PACK_ID: AuthorityPackId = 'wikidata-viaf-concordance';

export interface ViafWikidataPair {
  wikidata: string;
  viaf: string;
}

export interface ViafWikidataIndex {
  /** Q-id (with Q prefix) → VIAF cluster id(s). */
  viafByWikidata: Map<string, Set<string>>;
  /** VIAF cluster id → Q-id(s). */
  wikidataByViaf: Map<string, Set<string>>;
}

/** Normalize to `Q123` (accepts `123`, `Q123`, or a Wikidata URL). */
export function normalizeWikidataQid(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/wikidata\.org\/(?:wiki|entity)\/(Q\d+)/i)?.[1];
  if (fromUrl) return fromUrl.toUpperCase();
  const withQ = trimmed.match(/^Q?(\d+)$/i);
  if (withQ) return `Q${withQ[1]}`;
  const embedded = trimmed.match(/\b(Q\d{3,})\b/i);
  return embedded ? embedded[1]!.toUpperCase() : null;
}

/** Normalize to digits-only VIAF cluster id (accepts bare id or viaf.org URL). */
export function normalizeViafId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/viaf\.org\/(?:[a-z]{2}\/)?viaf\/(\d+)/i)?.[1];
  if (fromUrl) return fromUrl;
  const digits = trimmed.match(/^(\d+)$/);
  return digits ? digits[1]! : null;
}

export function emptyViafWikidataIndex(): ViafWikidataIndex {
  return { viafByWikidata: new Map(), wikidataByViaf: new Map() };
}

export function addViafWikidataPair(index: ViafWikidataIndex, wikidata: string, viaf: string): void {
  const qid = normalizeWikidataQid(wikidata);
  const viafId = normalizeViafId(viaf);
  if (!qid || !viafId) return;

  let viafs = index.viafByWikidata.get(qid);
  if (!viafs) {
    viafs = new Set();
    index.viafByWikidata.set(qid, viafs);
  }
  viafs.add(viafId);

  let qids = index.wikidataByViaf.get(viafId);
  if (!qids) {
    qids = new Set();
    index.wikidataByViaf.set(viafId, qids);
  }
  qids.add(qid);
}

/**
 * Ingest `metadata.crosswalk` from a pack row. Wikidata Q-id may be the row's
 * `authorityId` and/or `crosswalk.wikidata` (often digits without a Q prefix).
 */
export function addPairFromPackCrosswalk(
  index: ViafWikidataIndex,
  crosswalk: Record<string, string | string[] | undefined> | undefined,
  authorityId?: string | null,
): void {
  if (!crosswalk) return;
  const viafRaw = crosswalk.viaf;
  if (viafRaw == null) return;
  const viafValues = Array.isArray(viafRaw) ? viafRaw : [viafRaw];

  const qids = new Set<string>();
  const fromAuthority = normalizeWikidataQid(authorityId ?? undefined);
  if (fromAuthority) qids.add(fromAuthority);
  const wdRaw = crosswalk.wikidata;
  if (wdRaw != null) {
    for (const entry of Array.isArray(wdRaw) ? wdRaw : [wdRaw]) {
      const qid = normalizeWikidataQid(String(entry));
      if (qid) qids.add(qid);
    }
  }
  if (qids.size === 0) return;

  for (const viaf of viafValues) {
    for (const qid of qids) addViafWikidataPair(index, qid, String(viaf));
  }
}

/** Parse `{ "wikidata": "Q31", "viaf": "144248059" }` lines (also accepts digit-only Q). */
export function parseViafWikidataConcordance(content: AuthorityPackContent): ViafWikidataIndex {
  const index = emptyViafWikidataIndex();
  for (const line of authorityPackLines(content)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as { wikidata?: string; viaf?: string; qid?: string };
      const wikidata = row.wikidata ?? row.qid;
      if (wikidata == null || row.viaf == null) continue;
      addViafWikidataPair(index, String(wikidata), String(row.viaf));
    } catch {
      // skip corrupt lines
    }
  }
  return index;
}

/** Scan compiled AuthorityCandidate NDJSON and collect VIAF↔Wikidata pairs. */
export function indexViafWikidataFromPackNdjson(content: AuthorityPackContent): ViafWikidataIndex {
  const index = emptyViafWikidataIndex();
  for (const line of authorityPackLines(content)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as {
        authorityId?: string;
        metadata?: { crosswalk?: Record<string, string | string[] | undefined> };
        crosswalk?: Record<string, string | string[] | undefined>;
      };
      addPairFromPackCrosswalk(
        index,
        row.metadata?.crosswalk ?? row.crosswalk,
        row.authorityId,
      );
    } catch {
      // skip
    }
  }
  return index;
}

export function mergeViafWikidataIndexes(...indexes: ViafWikidataIndex[]): ViafWikidataIndex {
  const out = emptyViafWikidataIndex();
  for (const index of indexes) {
    for (const [qid, viafs] of index.viafByWikidata) {
      for (const viaf of viafs) addViafWikidataPair(out, qid, viaf);
    }
  }
  return out;
}

function candidateQids(candidate: ViafWikidataEnrichable): string[] {
  const out = new Set<string>();
  const consider = (text: string | undefined) => {
    const qid = normalizeWikidataQid(text);
    if (qid) out.add(qid);
  };
  consider(candidate.uri);
  consider(candidate.description);
  for (const auth of candidate.authorityIds ?? []) consider(auth.value);
  return [...out];
}

function candidateViafs(candidate: ViafWikidataEnrichable): string[] {
  const out = new Set<string>();
  const consider = (text: string | undefined) => {
    const viaf = normalizeViafId(text);
    if (viaf) out.add(viaf);
  };
  consider(candidate.uri);
  consider(candidate.description);
  for (const auth of candidate.authorityIds ?? []) {
    if (auth.type.toLowerCase() === 'viaf') consider(auth.value);
    else consider(auth.value);
  }
  return [...out];
}

/**
 * Attach missing Wikidata / VIAF authority ids from the concordance so
 * cross-authority collapse can union live LINCS rows.
 */
export function enrichCandidatesWithViafWikidataConcordance<T extends ViafWikidataEnrichable>(
  candidates: T[],
  index: ViafWikidataIndex,
): T[] {
  if (candidates.length === 0) return candidates;
  if (index.viafByWikidata.size === 0 && index.wikidataByViaf.size === 0) return candidates;

  return candidates.map((candidate) => {
    const authorityIds = [...(candidate.authorityIds ?? [])];
    const seen = new Set(authorityIds.map((id) => `${id.type.toLowerCase()}\0${id.value}`));
    const add = (type: AuthorityId['type'], value: string) => {
      const key = `${type.toLowerCase()}\0${value}`;
      if (seen.has(key)) return;
      seen.add(key);
      authorityIds.push({ type, value });
    };

    for (const qid of candidateQids(candidate)) {
      for (const viaf of index.viafByWikidata.get(qid) ?? []) add('VIAF', viaf);
    }
    for (const viaf of candidateViafs(candidate)) {
      for (const qid of index.wikidataByViaf.get(viaf) ?? []) add('Wikidata', qid);
    }

    return authorityIds.length === (candidate.authorityIds?.length ?? 0)
      ? candidate
      : { ...candidate, authorityIds };
  });
}

/** Authority ids implied by a pack row's crosswalk (for pack match rows). */
const CROSSWALK_IDNO_TYPES: Record<string, string> = {
  cbdb: 'CBDB',
  chgis: 'CHGIS',
  dila: 'DILA',
  wikidata: 'Wikidata',
  viaf: 'VIAF',
  ndl: 'NDL',
  bdrc: 'BDRC',
  norbert: 'NORBERT',
};

/**
 * Emit every authority id carried on a pack row's `metadata.crosswalk`.
 * VIAF/Wikidata are normalized; Norbert ids are kind-prefixed (`person-12`).
 */
export function authorityIdsFromPackCrosswalk(
  crosswalk: Record<string, string | string[] | undefined> | undefined,
  options?: { norbertKind?: string | null },
): AuthorityId[] {
  if (!crosswalk) return [];
  const out: AuthorityId[] = [];
  const norbertKind = options?.norbertKind ?? 'person';

  for (const [key, entry] of Object.entries(crosswalk)) {
    const type = CROSSWALK_IDNO_TYPES[key];
    if (!type || entry == null) continue;
    for (const raw of Array.isArray(entry) ? entry : [entry]) {
      if (raw == null || String(raw).trim() === '') continue;
      if (type === 'VIAF') {
        const viaf = normalizeViafId(String(raw));
        if (viaf) out.push({ type, value: viaf });
        continue;
      }
      if (type === 'Wikidata') {
        const qid = normalizeWikidataQid(String(raw));
        if (qid) out.push({ type, value: qid });
        continue;
      }
      if (type === 'NORBERT') {
        out.push({ type, value: formatNorbertAuthorityValue(norbertKind, raw) });
        continue;
      }
      out.push({ type, value: String(raw).trim() });
    }
  }
  return out;
}

type ReadPack = (packId: AuthorityPackId) => Promise<AuthorityPackContent>;

let concordancePromise: Promise<ViafWikidataIndex> | null = null;

/** Test helper — drop the session cache. */
export function clearViafWikidataConcordanceCacheForTests(): void {
  concordancePromise = null;
}

/**
 * Load the dedicated concordance pack when installed. Missing pack → empty index
 * (regex / description scraping remains as a fallback).
 */
export async function loadViafWikidataConcordance(readPackFile: ReadPack): Promise<ViafWikidataIndex> {
  concordancePromise ??= (async () => {
    try {
      const content = await readPackFile(VIAF_WIKIDATA_CONCORDANCE_PACK_ID);
      return parseViafWikidataConcordance(content);
    } catch {
      return emptyViafWikidataIndex();
    }
  })();
  return concordancePromise;
}
