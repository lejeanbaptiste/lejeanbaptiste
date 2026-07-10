import { reconcile } from '../services/lincs-api';
import type { NamedEntityType } from '../types';
import type { AuthorityLookupResult } from '../types/authority';
import { AuthorityCache } from './authorityCache';
import {
  addEntity,
  ENTITY_KINDS,
  findEntity,
  getDatabaseId,
  parseIsoYear,
  TAG_TO_KIND,
  type AuthorityId,
  type EntityKind,
} from './entities';
import type { EntityStore } from './entityStore';
import { filterReconcileByExactSurface, stringsMatchExactly } from './disambiguationMatch';
import { fetchWikidataLifespan, prefixDescriptionWithLifespan } from './wikidataDates';
import { fetchDilaPlaceDetail, type DilaFetchFn } from './dilaPlaceDetail';
import { DilaPlaceDetailCache } from './dilaPlaceDetailCache';
import { wikidataQidsMatchingKind } from './wikidataKindFilter';
import { packIdsForEntityType, searchPackRows } from '../services/authority-pack-lookup';
import { AUTHORITY_PACKS } from './packPaths';
import {
  normalizeDateRangeFilter,
  parseAuthorityNdjson,
  type DateRangeFilter,
} from './packLoader';
import type { AuthorityCandidate } from './authority';
import type { AuthorityPackId } from './packPaths';

export interface DisambiguationCandidate {
  id: string;
  label: string;
  description?: string;
  sources: string[];
  uri?: string;
  authorityIds?: AuthorityId[];
  localEntityId?: string;
  fromEntityFile?: boolean;
  /** Birth/founding year (persons: Wikidata P569; CHGIS places: metadata.startYear). */
  startYear?: number;
  /** Death/dissolution year (persons: Wikidata P570; CHGIS places: metadata.endYear). */
  endYear?: number;
  /** DILA place records are split one-per-dynasty (e.g. 東晉); kept for a future dynasty filter/picker. */
  dynasty?: string;
}

const TAG_TO_ENTITY_TYPE: Record<string, NamedEntityType> = {
  persName: 'person',
  placeName: 'place',
  orgName: 'organization',
  title: 'work',
  bibl: 'work',
};

const AUTHORITY_MAP: Record<string, 'wikidata' | 'viaf' | 'dbpedia' | 'geonames' | 'getty' | 'gnd'> = {
  Wikidata: 'wikidata',
  VIAF: 'viaf',
  DBPedia: 'dbpedia',
  Geonames: 'geonames',
  Getty: 'getty',
  GND: 'gnd',
};

/** Match against the name child's text only — `element.textContent` would also pick up note/idno text. */
function entityNameMatches(element: Element, nameTag: string, surface: string): boolean {
  const name = element.getElementsByTagName(nameTag)[0]?.textContent?.trim() ?? '';
  return stringsMatchExactly(surface, name);
}

/** Pull a Wikidata Q-id from URIs, VIAF source codes (WKP|Q…), or free text. */
export function extractWikidataId(text: string): string | null {
  const urlMatch = text.match(/wikidata\.org\/(?:wiki|entity)\/(Q\d+)/i);
  if (urlMatch) return urlMatch[1]!.toUpperCase();

  const wkpMatch = text.match(/WKP\|(Q\d+)/i);
  if (wkpMatch) return wkpMatch[1]!.toUpperCase();

  const bare = text.match(/\b(Q\d{3,})\b/i);
  return bare ? bare[1]!.toUpperCase() : null;
}

/** Pull a VIAF numeric id from a cluster URI (with or without a locale segment, e.g. `viaf.org/fr/viaf/…`). */
export function extractViafId(text: string): string | null {
  const match = text.match(/viaf\.org\/(?:[a-z]{2}\/)?viaf\/(\d+)/i);
  return match ? match[1]! : null;
}

/** Pull a CBDB person id from LINCS/Wikidata description text (e.g. "CBDB ID = 392870"). */
export function extractCbdbId(text: string): string | null {
  const match = text.match(/CBDB\s*(?:ID\s*)?=\s*(\d+)/i);
  return match ? match[1]! : null;
}

export const CBDB_PERSON_URL = (id: string) => `https://cbdb.fas.harvard.edu/person?id=${id}`;
export const DILA_PERSON_URL = (id: string) => `https://authority.dila.edu.tw/person/search.php?code=${id}`;
export const DILA_PLACE_URL = (id: string) => `https://authority.dila.edu.tw/place/search.php?code=${id}`;
export const DILA_URL = (id: string) => (id.startsWith('PL') ? DILA_PLACE_URL(id) : DILA_PERSON_URL(id));

export type WikipediaSite = 'enwiki' | 'zhwiki';

export const WIKIDATA_ITEM_URL = (qid: string) => `https://www.wikidata.org/wiki/${qid}`;

/**
 * Open the Wikipedia article for a Q-id via Wikidata sitelinks.
 * Must use wikidata.org — `Special:EntityPage` is not a valid page on en.wikipedia.org.
 */
export const WIKIPEDIA_ARTICLE_URL = (qid: string, site: WikipediaSite = 'enwiki') =>
  `https://www.wikidata.org/wiki/Special:GoToLinkedPage/${site}/${qid}`;

export function preferredWikipediaSite(locale?: string): WikipediaSite {
  const primary = locale?.split('-')[0]?.toLowerCase();
  return primary === 'zh' ? 'zhwiki' : 'enwiki';
}

export interface CandidateLink {
  kind: 'wikidata' | 'viaf' | 'cbdb' | 'dila';
  url: string;
  title: string;
}

export interface CandidateLinkOptions {
  /** @deprecated Wikipedia sitelinks are not used; links open the Wikidata item page. */
  wikiSite?: WikipediaSite;
}

/** External links for a candidate row (Wikidata item, VIAF cluster, etc.). */
export function candidateLinks(
  candidate: DisambiguationCandidate,
  _options: CandidateLinkOptions = {},
): CandidateLink[] {
  const links: CandidateLink[] = [];
  const seen = new Set<string>();

  const add = (kind: CandidateLink['kind'], url: string, title: string) => {
    if (seen.has(url)) return;
    seen.add(url);
    links.push({ kind, url, title });
  };

  const scan = (text: string | undefined) => {
    if (!text) return;
    const qid = extractWikidataId(text);
    if (qid) {
      add('wikidata', WIKIDATA_ITEM_URL(qid), `Wikidata (${qid})`);
    }
    const viaf = extractViafId(text);
    if (viaf) add('viaf', `https://viaf.org/viaf/${viaf}`, `VIAF ${viaf}`);
    const cbdb = extractCbdbId(text);
    if (cbdb) add('cbdb', CBDB_PERSON_URL(cbdb), `CBDB ${cbdb}`);
  };

  scan(candidate.uri);
  scan(candidate.description);
  for (const auth of candidate.authorityIds ?? []) {
    if (auth.type === 'CBDB') {
      add('cbdb', CBDB_PERSON_URL(auth.value), `CBDB ${auth.value}`);
    }
    if (auth.type === 'DILA') {
      add('dila', DILA_URL(auth.value), `DILA ${auth.value}`);
    }
    scan(auth.value);
  }

  return links;
}

function authorityKeysForCandidate(candidate: DisambiguationCandidate): string[] {
  const keys = new Set<string>();
  const scan = (text: string | undefined) => {
    if (!text) return;
    const wd = extractWikidataId(text);
    if (wd) keys.add(`wikidata:${wd}`);
    const viaf = extractViafId(text);
    if (viaf) keys.add(`viaf:${viaf}`);
    const cbdb = extractCbdbId(text);
    if (cbdb) keys.add(`cbdb:${cbdb}`);
  };

  scan(candidate.uri);
  scan(candidate.description);
  scan(candidate.label);
  for (const auth of candidate.authorityIds ?? []) {
    scan(auth.value);
    if (auth.type.toLowerCase().includes('wikidata')) {
      const wd = extractWikidataId(auth.value);
      if (wd) keys.add(`wikidata:${wd}`);
    }
    if (auth.type.toLowerCase() === 'viaf') {
      const viaf = extractViafId(auth.value);
      if (viaf) keys.add(`viaf:${viaf}`);
    }
    if (auth.type === 'CBDB') keys.add(`cbdb:${auth.value}`);
    if (auth.type === 'DILA') keys.add(`dila:${auth.value}`);
  }
  return [...keys];
}

function dedupeAuthorityIds(ids: AuthorityId[]): AuthorityId[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const key = `${id.type}\0${id.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Pull cross-authority ids embedded in reconcile description text. */
export function enrichCandidateCrossRefs(candidate: DisambiguationCandidate): DisambiguationCandidate {
  const authorityIds = dedupeAuthorityIds(
    authorityIdsFromCrossRefs(
      candidate.authorityIds ?? [],
      candidate.description,
      candidate.uri,
    ),
  );
  return { ...candidate, authorityIds };
}

function authorityIdsFromCrossRefs(
  base: AuthorityId[],
  ...texts: (string | undefined)[]
): AuthorityId[] {
  const out = [...base];
  const seen = new Set(out.map((id) => `${id.type}\0${id.value}`));
  const add = (type: AuthorityId['type'], value: string) => {
    const key = `${type}\0${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ type, value });
  };
  for (const text of texts) {
    if (!text) continue;
    const wikidata = text.match(/wikidata\.org\/(?:wiki|entity)\/(Q\d+)/i)?.[1]?.toUpperCase();
    if (wikidata) add('Wikidata', wikidata);

    const viaf = text.match(/viaf\.org\/(?:[a-z]{2}\/)?viaf\/(\d+)/i)?.[1];
    if (viaf) add('VIAF', viaf);

    const cbdb = extractCbdbId(text);
    if (cbdb) add('CBDB', cbdb);

    const dila = text.match(/authority\.dila\.edu\.tw\/[^\s]*?(?:aid=|fromInner=|code=|\/)([A-Z]{1,2}\d+)/)?.[1];
    if (dila) add('DILA', dila);

    const ndl = text.match(/id\.ndl\.go\.jp\/auth\/(?:ndlna|ndlsh)\/([\w-]+)/i)?.[1];
    if (ndl) add('NDL', ndl);
  }
  return out;
}

/** Merge checked rows into one candidate (manual link or accept). */
export function mergeSelectedCandidates(
  candidates: DisambiguationCandidate[],
): DisambiguationCandidate | null {
  if (candidates.length === 0) return null;
  const first = candidates[0]!;
  const fromFile = candidates.find((c) => c.fromEntityFile);
  const startYears = candidates.map((c) => c.startYear).filter((y): y is number => y != null);
  const endYears = candidates.map((c) => c.endYear).filter((y): y is number => y != null);
  return {
    id: fromFile?.id ?? first.id,
    label: fromFile?.label ?? first.label,
    description:
      candidates
        .map((c) => c.description)
        .filter(Boolean)
        .join(' · ') || first.description,
    sources: [...new Set(candidates.flatMap((c) => c.sources))],
    uri: fromFile?.uri ?? first.uri,
    localEntityId: fromFile?.localEntityId ?? first.localEntityId,
    fromEntityFile: candidates.some((c) => c.fromEntityFile),
    authorityIds: dedupeAuthorityIds(candidates.flatMap((c) => c.authorityIds ?? [])),
    startYear: startYears.length ? Math.min(...startYears) : undefined,
    endYear: endYears.length ? Math.max(...endYears) : undefined,
    dynasty: candidates.find((c) => c.dynasty)?.dynasty,
  };
}

/** Collapse rows that share a Wikidata Q-id or other cross-authority key. */
export function collapseCrossAuthorityCandidates(
  candidates: DisambiguationCandidate[],
): DisambiguationCandidate[] {
  if (candidates.length < 2) return candidates;

  const parent = candidates.map((_, index) => index);
  const find = (index: number): number =>
    parent[index] === index ? index : (parent[index] = find(parent[index]!));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  const keyToIndices = new Map<string, number[]>();
  candidates.forEach((candidate, index) => {
    for (const key of authorityKeysForCandidate(candidate)) {
      const list = keyToIndices.get(key) ?? [];
      list.push(index);
      keyToIndices.set(key, list);
    }
  });

  for (const indices of keyToIndices.values()) {
    const head = indices[0]!;
    for (let i = 1; i < indices.length; i++) union(head, indices[i]!);
  }

  const groups = new Map<number, DisambiguationCandidate[]>();
  candidates.forEach((candidate, index) => {
    const root = find(index);
    const list = groups.get(root) ?? [];
    list.push(candidate);
    groups.set(root, list);
  });

  return [...groups.values()].map((group) => mergeSelectedCandidates(group)!);
}

/** Candidates from the local entity file matching surface text. */
export function candidatesFromEntityFile(doc: Document, tag: string, surface: string): DisambiguationCandidate[] {
  const kind = TAG_TO_KIND[tag];
  if (!kind) return [];

  const listTag =
    kind === 'person'
      ? 'person'
      : kind === 'place'
        ? 'place'
        : kind === 'org'
          ? 'org'
          : 'bibl';

  const nameTag = ENTITY_KINDS[kind].name;
  const items = doc.getElementsByTagName(listTag);
  const out: DisambiguationCandidate[] = [];
  for (let i = 0; i < items.length; i++) {
    const el = items.item(i)!;
    if (!entityNameMatches(el, nameTag, surface)) continue;
    const localId = el.getAttribute('xml:id') ?? '';
    const idnos = Array.from(el.getElementsByTagName('idno'));
    const authorityIds: AuthorityId[] = idnos.map((idno) => ({
      type: idno.getAttribute('type') ?? 'unknown',
      value: idno.textContent?.trim() ?? '',
    }));
    const notes = Array.from(el.getElementsByTagName('note'));
    const descriptionNote =
      notes.find((note) => note.getAttribute('type') === 'description') ??
      notes.find((note) => !note.getAttribute('type'));
    let startYear = parseIsoYear(el.getElementsByTagName('birth')[0]?.getAttribute('when')) ?? undefined;
    let endYear = parseIsoYear(el.getElementsByTagName('death')[0]?.getAttribute('when')) ?? undefined;
    const datesNote = notes.find((note) => note.getAttribute('type') === 'dates');
    if (startYear == null && endYear == null && datesNote) {
      const [start, end] = (datesNote.textContent ?? '').split('/');
      startYear = parseIsoYear(start) ?? undefined;
      endYear = parseIsoYear(end) ?? undefined;
    }
    out.push({
      id: localId || `local-${i}`,
      label: el.getElementsByTagName(nameTag)[0]?.textContent?.trim() || surface,
      description: descriptionNote?.textContent ?? undefined,
      sources: ['entity-file'],
      localEntityId: localId || undefined,
      authorityIds,
      fromEntityFile: true,
      startYear,
      endYear,
    });
  }
  return out;
}

function mergeCandidates(lists: DisambiguationCandidate[][]): DisambiguationCandidate[] {
  const byLocal = new Map<string, DisambiguationCandidate>();
  const out: DisambiguationCandidate[] = [];

  for (const list of lists) {
    for (const candidate of list) {
      if (candidate.localEntityId) {
        const existing = byLocal.get(candidate.localEntityId);
        if (existing) {
          existing.sources = Array.from(new Set([...existing.sources, ...candidate.sources]));
          if (candidate.authorityIds) {
            existing.authorityIds = [...(existing.authorityIds ?? []), ...candidate.authorityIds];
          }
          continue;
        }
        byLocal.set(candidate.localEntityId, candidate);
        out.push(candidate);
        continue;
      }

      const dup = out.find((c) => c.uri && c.uri === candidate.uri);
      if (dup) {
        dup.sources = Array.from(new Set([...dup.sources, ...candidate.sources]));
        continue;
      }
      out.push(candidate);
    }
  }
  return collapseCrossAuthorityCandidates(out.map(enrichCandidateCrossRefs));
}

/** Session-lifetime cache of Wikidata Q-id → lifespan (or null when none found). */
const wikidataLifespanCache = new Map<string, Awaited<ReturnType<typeof fetchWikidataLifespan>>>();

/** Drop Wikidata reconcile rows whose Q-id is not the expected entity kind. */
async function filterWikidataByKind<T extends { uri: string; description?: string }>(
  matches: T[],
  kind: EntityKind,
  cache: AuthorityCache,
): Promise<T[]> {
  if (matches.length === 0) return matches;

  const withQid: Array<{ match: T; qid: string }> = [];
  for (const match of matches) {
    const qid =
      extractWikidataId(match.uri) ?? extractWikidataId(match.description ?? '');
    if (qid) withQid.push({ match, qid });
  }
  if (withQid.length === 0) return [];

  const qids = [...new Set(withQid.map((row) => row.qid))];
  await cache.throttle();
  const matching = await wikidataQidsMatchingKind(qids, kind);
  return withQid.filter((row) => matching.has(row.qid)).map((row) => row.match);
}

export type ReadAuthorityPackFile = (packId: AuthorityPackId) => Promise<string>;

export function clearPersonPackIndexForTests(): void {
  chgisIndexPromise = null;
}

/** Session-lifetime cache of parsed CHGIS rows, keyed by exact search string. */
let chgisIndexPromise: Promise<Map<string, { startYear?: number; endYear?: number }>> | null = null;

function buildChgisIndex(rows: AuthorityCandidate[]): Map<string, { startYear?: number; endYear?: number }> {
  const index = new Map<string, { startYear?: number; endYear?: number }>();
  for (const row of rows) {
    const years = { startYear: row.metadata?.startYear, endYear: row.metadata?.endYear };
    if (years.startYear == null && years.endYear == null) continue;
    for (const str of row.searchStrings) {
      if (!index.has(str)) index.set(str, years);
    }
  }
  return index;
}

/** Look up begin/end years for a place surface string in the installed CHGIS pack (cached for the session). */
async function chgisYearsForSurface(
  surface: string,
  readPackFile: ReadAuthorityPackFile,
): Promise<{ startYear?: number; endYear?: number } | null> {
  chgisIndexPromise ??= (async () => {
    try {
      const content = await readPackFile('chgis-places');
      return buildChgisIndex(parseAuthorityNdjson(content));
    } catch {
      return new Map();
    }
  })();
  const index = await chgisIndexPromise;
  return index.get(surface) ?? null;
}

/**
 * Fetch and cache live 備註/朝代 dates for a DILA place id in the background.
 * Local pack metadata already covers a handful of places whose remark date range
 * was extractable from the bulk XML export; this fills in the rest on demand,
 * scraping the live record page (there is no by-string search API — only by id).
 * Fire-and-forget: the disambiguation panel must not block on a live network
 * scrape just to open, so misses are queued rather than awaited inline.
 */
async function fetchAndCacheDilaPlaceDetail(
  authorityId: string,
  dilaDetailCache: DilaPlaceDetailCache,
  fetchImpl?: DilaFetchFn,
): Promise<void> {
  await dilaDetailCache.throttle();
  try {
    const detail = await fetchDilaPlaceDetail(authorityId, fetchImpl);
    if (detail) await dilaDetailCache.set(authorityId, detail);
  } catch {
    // best-effort; the candidate stays undated until a later lookup retries
  }
}

async function candidatesFromAuthorityPacks(
  tag: string,
  surface: string,
  readPackFile: ReadAuthorityPackFile,
  dilaDetailCache?: DilaPlaceDetailCache,
  dilaFetchImpl?: DilaFetchFn,
  onDilaDatesReady?: () => void,
): Promise<DisambiguationCandidate[]> {
  const entityType = TAG_TO_ENTITY_TYPE[tag] ?? 'person';
  const packIds = packIdsForEntityType(
    ['cbdb-persons', 'cbdb-places', 'cbdb-offices', 'dila-persons', 'dila-places', 'chgis-places', 'ndl-persons', 'ndl-places', 'ndl-orgs', 'ndl-works'],
    entityType,
  );
  const results: DisambiguationCandidate[] = [];
  const pendingDilaFetches: Promise<void>[] = [];
  for (const packId of packIds) {
    try {
      const content = await readPackFile(packId);
      const spec = AUTHORITY_PACKS.find((item) => item.id === packId);
      if (!spec) continue;
      const packSource = spec.source as 'cbdb' | 'dila' | 'ndl';
      // searchPackRows hands back each match's parsed ndjson row, so the
      // metadata (years, dynasty, authorityId) comes straight from the ≤10
      // matched lines — no full-pack parse per lookup.
      for (const { result: match, row } of searchPackRows(content, packSource, entityType, surface)) {
        let description = match.description;
        let startYear = row?.metadata?.startYear;
        let endYear = row?.metadata?.endYear;
        let dynasty: string | undefined;

        if (
          packSource === 'dila' &&
          entityType === 'place' &&
          dilaDetailCache &&
          row?.authorityId &&
          startYear == null &&
          endYear == null
        ) {
          const cached = await dilaDetailCache.get(row.authorityId);
          if (cached) {
            startYear = cached.startYear ?? startYear;
            endYear = cached.endYear ?? endYear;
            if (cached.remark) description = cached.remark;
            // DILA splits a place into one record per dynasty — lead with it so
            // same-named candidates read as distinct entries, and keep it on the
            // candidate/cache for a future dynasty filter/picker.
            if (cached.dynasty) {
              dynasty = cached.dynasty;
              description = description ? `${cached.dynasty}：${description}` : cached.dynasty;
            }
          } else {
            // Don't block opening the panel on a live scrape; queue it and
            // let the caller refresh once every queued id has resolved.
            pendingDilaFetches.push(
              fetchAndCacheDilaPlaceDetail(row.authorityId, dilaDetailCache, dilaFetchImpl),
            );
          }
        }

        results.push({
          id: match.uri,
          label: match.label,
          description,
          sources: [spec.source.toUpperCase()],
          uri: match.uri,
          authorityIds: dedupeAuthorityIds(
            // The bare authorityId, not match.uri — auth.value must be an id a
            // *_URL() builder can format, not an already-fully-formed URL (which
            // would otherwise get wrapped inside another URL and break the link).
            authorityIdsFromCrossRefs(
              [{ type: packSource.toUpperCase(), value: row?.authorityId ?? match.uri }],
              match.description,
            ),
          ),
          startYear,
          endYear,
          dynasty,
        });
      }
    } catch {
      // Missing or unreadable pack; skip it.
    }
  }
  if (pendingDilaFetches.length > 0 && onDilaDatesReady) {
    void Promise.all(pendingDilaFetches).then(onDilaDatesReady);
  }
  return results;
}

/**
 * Same include/exclude semantics as {@link candidatePassesDateFilter}, applied to a live
 * disambiguation candidate's `startYear`/`endYear` (persons, and CHGIS-matched places).
 */
export function candidatePassesYearFilter(
  candidate: DisambiguationCandidate,
  filter?: DateRangeFilter,
): boolean {
  if (!filter || filter.mode === 'none') return true;

  const { start, end } = normalizeDateRangeFilter(filter);
  const yearStart = candidate.startYear;
  const yearEnd = candidate.endYear ?? candidate.startYear;
  const undated = yearStart == null && yearEnd == null;

  if (undated) return filter.mode === 'exclude';

  const lo = yearStart ?? yearEnd!;
  const hi = yearEnd ?? yearStart!;
  const overlaps = lo <= end && hi >= start;
  return filter.mode === 'limit' ? overlaps : !overlaps;
}

async function lifespanForQid(qid: string, cache: AuthorityCache) {
  if (wikidataLifespanCache.has(qid)) return wikidataLifespanCache.get(qid)!;
  await cache.throttle();
  let lifespan: Awaited<ReturnType<typeof fetchWikidataLifespan>> = null;
  try {
    lifespan = await fetchWikidataLifespan(qid);
  } catch {
    lifespan = null;
  }
  wikidataLifespanCache.set(qid, lifespan);
  return lifespan;
}

export async function fetchLiveCandidates(
  tag: string,
  surface: string,
  cache: AuthorityCache,
  enabledAuthorities: Array<keyof typeof AUTHORITY_MAP>,
  forceRefresh = false,
  readPackFile?: ReadAuthorityPackFile,
): Promise<DisambiguationCandidate[]> {
  const entityType = TAG_TO_ENTITY_TYPE[tag] ?? 'person';
  const entityKind = TAG_TO_KIND[tag];
  const results: DisambiguationCandidate[] = [];
  const chgisYears = tag === 'placeName' && readPackFile ? await chgisYearsForSurface(surface, readPackFile) : null;

  for (const name of enabledAuthorities) {
    const authorityId = AUTHORITY_MAP[name];
    if (!authorityId) continue;

    let cached = await cache.get(name, entityType, surface, forceRefresh);
    let matches: AuthorityLookupResult[] = cached?.results ?? [];

    if (!cached) {
      await cache.throttle();
      try {
        matches = await reconcile({
          query: surface,
          entityType,
          options: { authorityId, isUserAuthenticated: false },
        });
        await cache.set({
          authority: name,
          entityType,
          query: surface,
          fetchedAt: new Date().toISOString(),
          results: matches,
        });
      } catch {
        matches = [];
      }
    }

    if (name === 'Wikidata') {
      if (entityKind) {
        matches = await filterWikidataByKind(matches, entityKind, cache);
      }
      // Exact-surface matching only makes sense against Wikidata: its reconcile rows
      // reliably return the queried script as label/alias. VIAF/DBpedia/Getty/GND
      // headings are authority-specific (often romanized, "Surname, Given, dates")
      // and rarely equal the raw surface text — filtering them the same way silently
      // dropped every non-Wikidata authority.
      await cache.throttle();
      matches = await filterReconcileByExactSurface(matches, surface);
    }

    for (const match of matches) {
      let description = match.description;
      let startYear: number | undefined;
      let endYear: number | undefined;
      if (entityType === 'person') {
        const qid = extractWikidataId(match.uri) ?? extractWikidataId(match.description ?? '');
        if (qid) {
          const lifespan = await lifespanForQid(qid, cache);
          description = prefixDescriptionWithLifespan(description, lifespan);
          startYear = lifespan?.birthYear;
          endYear = lifespan?.deathYear;
        }
      } else if (entityType === 'place' && chgisYears) {
        startYear = chgisYears.startYear;
        endYear = chgisYears.endYear;
      }
      results.push({
        id: match.uri,
        label: match.label,
        description,
        sources: [name],
        uri: match.uri,
        authorityIds: dedupeAuthorityIds(
          authorityIdsFromCrossRefs([{ type: name, value: match.uri }], match.description),
        ),
        startYear,
        endYear,
      });
    }
  }

  return results;
}

export async function buildDisambiguationCandidates(
  entitiesDoc: Document,
  tag: string,
  surface: string,
  cache: AuthorityCache,
  enabledAuthorities: Array<keyof typeof AUTHORITY_MAP> = ['Wikidata', 'VIAF'],
  forceRefresh = false,
  readPackFile?: ReadAuthorityPackFile,
  dilaDetailCache?: DilaPlaceDetailCache,
  dilaFetchImpl?: DilaFetchFn,
  onDilaDatesReady?: () => void,
): Promise<DisambiguationCandidate[]> {
  const local = candidatesFromEntityFile(entitiesDoc, tag, surface);
  const packLocal = readPackFile
    ? await candidatesFromAuthorityPacks(
        tag,
        surface,
        readPackFile,
        dilaDetailCache,
        dilaFetchImpl,
        onDilaDatesReady,
      )
    : [];
  const live = await fetchLiveCandidates(tag, surface, cache, enabledAuthorities, forceRefresh, readPackFile);
  return collapseCrossAuthorityCandidates(
    mergeCandidates([local, packLocal, live]).map(enrichCandidateCrossRefs),
  );
}

export interface ResolveEntityInput {
  kind: EntityKind;
  name: string;
  authorityIds?: AuthorityId[];
  description?: string;
  startYear?: number;
  endYear?: number;
}

/** Mint or reuse entity in database; returns local id. */
export function resolveEntityInDocument(
  entitiesDoc: Document,
  input: ResolveEntityInput,
  candidate?: DisambiguationCandidate,
): string {
  if (candidate?.localEntityId && findEntity(entitiesDoc, candidate.localEntityId)) {
    return candidate.localEntityId;
  }

  for (const auth of input.authorityIds ?? []) {
    const existingId = findEntityByAuthorityId(entitiesDoc, auth);
    if (existingId) return existingId;
  }

  const { id } = addEntity(entitiesDoc, input.kind, {
    name: input.name,
    authorityIds: input.authorityIds,
    description: input.description,
    startYear: input.startYear,
    endYear: input.endYear,
  });
  return id;
}

export async function ensureDatabaseLinked(
  store: EntityStore,
  projectDatabaseId: string | undefined,
): Promise<{ databaseId: string; mismatch: boolean }> {
  const doc = await store.loadEntities();
  const databaseId = getDatabaseId(doc) ?? '';
  return {
    databaseId,
    mismatch: Boolean(projectDatabaseId && databaseId && projectDatabaseId !== databaseId),
  };
}

function findEntityByAuthorityId(doc: Document, auth: AuthorityId): string | null {
  const idnos = doc.getElementsByTagName('idno');
  for (let i = 0; i < idnos.length; i++) {
    const idno = idnos.item(i);
    if (!idno) continue;
    if (idno.getAttribute('type') !== auth.type) continue;
    if (idno.textContent?.trim() !== auth.value) continue;
    const parent = idno.parentElement;
    const id = parent?.getAttribute('xml:id');
    if (id) return id;
  }
  return null;
}
