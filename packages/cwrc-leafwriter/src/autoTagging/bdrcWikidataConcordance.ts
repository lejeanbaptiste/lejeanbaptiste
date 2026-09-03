/**
 * Precompiled BDRC ↔ Wikidata links (Wikidata P2477) so live Wikidata lookup
 * rows can show a BDRC badge without scraping library.bdrc.io.
 *
 * Prefer the dedicated concordance sidecar when installed. Otherwise ask
 * Wikidata for P2477 on the QIDs already on screen — never scan the full
 * `wikidata-*-bo` packs just to paint a badge.
 */

import { normalizeBdrcId } from './bdrcIds';
import type { AuthorityId } from './entities';
import { authorityPackLines, type AuthorityPackContent } from './packLoader';
import type { AuthorityPackId } from './packPaths';
import { normalizeWikidataQid } from './viafWikidataConcordance';
import type { WikidataFetchFn } from './wikidataDates';

export interface BdrcWikidataEnrichable {
  uri?: string;
  description?: string;
  sources?: string[];
  authorityIds?: AuthorityId[];
}

export const BDRC_WIKIDATA_CONCORDANCE_PACK_ID: AuthorityPackId = 'wikidata-bdrc-concordance';

export interface BdrcWikidataIndex {
  bdrcByWikidata: Map<string, Set<string>>;
  wikidataByBdrc: Map<string, Set<string>>;
}

export function emptyBdrcWikidataIndex(): BdrcWikidataIndex {
  return { bdrcByWikidata: new Map(), wikidataByBdrc: new Map() };
}

export function addBdrcWikidataPair(
  index: BdrcWikidataIndex,
  wikidata: string,
  bdrc: string,
): void {
  const qid = normalizeWikidataQid(wikidata);
  const bdrcId = normalizeBdrcId(bdrc);
  if (!qid || !bdrcId) return;

  let bdrcs = index.bdrcByWikidata.get(qid);
  if (!bdrcs) {
    bdrcs = new Set();
    index.bdrcByWikidata.set(qid, bdrcs);
  }
  bdrcs.add(bdrcId);

  let qids = index.wikidataByBdrc.get(bdrcId);
  if (!qids) {
    qids = new Set();
    index.wikidataByBdrc.set(bdrcId, qids);
  }
  qids.add(qid);
}

/** Parse `{ "wikidata": "Q106801354", "bdrc": "P7758" }` lines. */
export function parseBdrcWikidataConcordance(content: AuthorityPackContent): BdrcWikidataIndex {
  const index = emptyBdrcWikidataIndex();
  for (const line of authorityPackLines(content)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as { wikidata?: string; qid?: string; bdrc?: string };
      const wikidata = row.wikidata ?? row.qid;
      if (wikidata == null || row.bdrc == null) continue;
      addBdrcWikidataPair(index, String(wikidata), String(row.bdrc));
    } catch {
      // skip corrupt lines
    }
  }
  return index;
}

/** Scan compiled AuthorityCandidate NDJSON for `metadata.crosswalk.bdrc`. */
export function indexBdrcWikidataFromPackNdjson(content: AuthorityPackContent): BdrcWikidataIndex {
  const index = emptyBdrcWikidataIndex();
  for (const line of authorityPackLines(content)) {
    if (!line.includes('bdrc')) continue;
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as {
        authorityId?: string;
        metadata?: { crosswalk?: { bdrc?: string | string[]; wikidata?: string | string[] } };
      };
      const bdrcRaw = row.metadata?.crosswalk?.bdrc;
      if (bdrcRaw == null) continue;
      const qids = new Set<string>();
      const fromAuthority = normalizeWikidataQid(row.authorityId);
      if (fromAuthority) qids.add(fromAuthority);
      const wdRaw = row.metadata?.crosswalk?.wikidata;
      if (wdRaw != null) {
        for (const entry of Array.isArray(wdRaw) ? wdRaw : [wdRaw]) {
          const qid = normalizeWikidataQid(String(entry));
          if (qid) qids.add(qid);
        }
      }
      for (const raw of Array.isArray(bdrcRaw) ? bdrcRaw : [bdrcRaw]) {
        for (const qid of qids) addBdrcWikidataPair(index, qid, String(raw));
      }
    } catch {
      // skip
    }
  }
  return index;
}

export function mergeBdrcWikidataIndexes(...indexes: BdrcWikidataIndex[]): BdrcWikidataIndex {
  const out = emptyBdrcWikidataIndex();
  for (const index of indexes) {
    for (const [qid, bdrcs] of index.bdrcByWikidata) {
      for (const bdrc of bdrcs) addBdrcWikidataPair(out, qid, bdrc);
    }
  }
  return out;
}

type ReadPack = (packId: AuthorityPackId) => Promise<AuthorityPackContent>;

let concordancePromise: Promise<BdrcWikidataIndex> | null = null;

/** Test helper — drop the session cache. */
export function clearBdrcWikidataConcordanceCacheForTests(): void {
  concordancePromise = null;
}

export async function loadBdrcWikidataConcordance(
  readPackFile: ReadPack,
): Promise<BdrcWikidataIndex> {
  concordancePromise ??= (async () => {
    try {
      const content = await readPackFile(BDRC_WIKIDATA_CONCORDANCE_PACK_ID);
      const dedicated = parseBdrcWikidataConcordance(content);
      if (dedicated.bdrcByWikidata.size > 0) return dedicated;
    } catch {
      // Sidecar missing, or Electron main not yet rebuilt to know this pack id.
    }
    // Do not scan wikidata-*-bo here: those files are tens of megabytes and
    // blocking lookup/disambiguate on a full IPC read meant P2477 never ran.
    return emptyBdrcWikidataIndex();
  })();
  return concordancePromise;
}

interface WikidataExternalIdClaim {
  mainsnak?: {
    snaktype?: string;
    datavalue?: { value?: string };
  };
}

interface WikidataEntitiesResponse {
  entities?: Record<string, { claims?: Record<string, WikidataExternalIdClaim[]> }>;
}

/** Live P2477 claims for QIDs the local packs do not yet know. */
export async function fetchBdrcIdsForQids(
  qids: string[],
  fetchImpl: WikidataFetchFn = fetch,
): Promise<BdrcWikidataIndex> {
  const index = emptyBdrcWikidataIndex();
  const unique = [
    ...new Set(qids.map((qid) => normalizeWikidataQid(qid)).filter(Boolean)),
  ] as string[];
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${chunk.join('|')}&props=claims&format=json&origin=*`;
    const response = await fetchImpl(url);
    if (!response.ok) continue;
    const data = (await response.json()) as WikidataEntitiesResponse;
    for (const [qid, entity] of Object.entries(data.entities ?? {})) {
      for (const claim of entity.claims?.P2477 ?? []) {
        if (claim.mainsnak?.snaktype !== 'value') continue;
        const value = claim.mainsnak.datavalue?.value;
        if (typeof value === 'string') addBdrcWikidataPair(index, qid, value);
      }
    }
  }
  return index;
}

export function qidsMissingBdrcLink(
  candidates: BdrcWikidataEnrichable[],
  index: BdrcWikidataIndex,
): string[] {
  const missing: string[] = [];
  for (const candidate of candidates) {
    for (const qid of candidateQids(candidate)) {
      if (!index.bdrcByWikidata.has(qid)) missing.push(qid);
    }
  }
  return [...new Set(missing)];
}

function candidateQids(candidate: BdrcWikidataEnrichable): string[] {
  const out = new Set<string>();
  const consider = (text: string | undefined) => {
    const qid = normalizeWikidataQid(text);
    if (qid) out.add(qid);
  };
  consider(candidate.uri);
  consider(candidate.description);
  for (const auth of candidate.authorityIds ?? []) {
    if (/^wikidata$/i.test(auth.type)) consider(auth.value);
  }
  return [...out];
}

function candidateBdrcs(candidate: BdrcWikidataEnrichable): string[] {
  const out = new Set<string>();
  const consider = (text: string | undefined) => {
    const bdrc = normalizeBdrcId(text ?? '');
    if (bdrc) out.add(bdrc);
  };
  consider(candidate.uri);
  consider(candidate.description);
  for (const auth of candidate.authorityIds ?? []) consider(auth.value);
  return [...out];
}

/**
 * Attach missing BDRC / Wikidata ids from P2477, and add BDRC to `sources`
 * so lookup/disambiguation badges appear (there is no live BDRC row to merge).
 */
export function enrichCandidatesWithBdrcWikidataConcordance<T extends BdrcWikidataEnrichable>(
  candidates: T[],
  index: BdrcWikidataIndex,
): T[] {
  if (candidates.length === 0) return candidates;
  if (index.bdrcByWikidata.size === 0 && index.wikidataByBdrc.size === 0) return candidates;

  return candidates.map((candidate) => {
    const authorityIds = [...(candidate.authorityIds ?? [])];
    const seen = new Set(authorityIds.map((id) => `${id.type.toLowerCase()}\0${id.value}`));
    const add = (type: AuthorityId['type'], value: string) => {
      const key = `${type.toLowerCase()}\0${value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      authorityIds.push({ type, value });
      return true;
    };

    let addedBdrc = false;
    for (const qid of candidateQids(candidate)) {
      for (const bdrc of index.bdrcByWikidata.get(qid) ?? []) {
        if (add('BDRC', bdrc)) addedBdrc = true;
      }
    }
    for (const bdrc of candidateBdrcs(candidate)) {
      for (const qid of index.wikidataByBdrc.get(bdrc) ?? []) add('Wikidata', qid);
    }

    const sources = candidate.sources ? [...candidate.sources] : undefined;
    if (addedBdrc && sources && !sources.some((source) => source.toLowerCase() === 'bdrc')) {
      sources.push('BDRC');
    }

    const idsUnchanged = authorityIds.length === (candidate.authorityIds?.length ?? 0);
    const sourcesUnchanged = !addedBdrc || !sources;
    if (idsUnchanged && sourcesUnchanged) return candidate;
    return {
      ...candidate,
      authorityIds,
      ...(sources ? { sources } : {}),
    };
  });
}
