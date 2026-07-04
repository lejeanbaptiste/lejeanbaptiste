import { reconcile } from '../services/lincs-api';
import type { NamedEntityType } from '../types';
import type { AuthorityLookupResult } from '../types/authority';
import { AuthorityCache } from './authorityCache';
import {
  addEntity,
  findEntity,
  getDatabaseId,
  TAG_TO_KIND,
  type AuthorityId,
  type EntityKind,
} from './entities';
import type { EntityStore } from './entityStore';

export interface DisambiguationCandidate {
  id: string;
  label: string;
  description?: string;
  sources: string[];
  uri?: string;
  authorityIds?: AuthorityId[];
  localEntityId?: string;
  fromEntityFile?: boolean;
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

function entityNameMatches(element: Element, surface: string): boolean {
  const name = element.textContent?.trim() ?? '';
  return name === surface || name.includes(surface);
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

/** Pull a VIAF numeric id from a cluster URI. */
export function extractViafId(text: string): string | null {
  const match = text.match(/viaf\.org\/viaf\/(\d+)/i);
  return match ? match[1]! : null;
}

/** Pull a CBDB person id from LINCS/Wikidata description text (e.g. "CBDB ID = 392870"). */
export function extractCbdbId(text: string): string | null {
  const match = text.match(/CBDB\s*(?:ID\s*)?=\s*(\d+)/i);
  return match ? match[1]! : null;
}

export const CBDB_PERSON_URL = (id: string) => `https://cbdb.fas.harvard.edu/person?id=${id}`;

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
  kind: 'wikipedia' | 'viaf' | 'cbdb';
  url: string;
  title: string;
}

export interface CandidateLinkOptions {
  /** Wikipedia language wiki for sitelink jump (default enwiki). */
  wikiSite?: WikipediaSite;
}

/** External links for a candidate row (Wikipedia article, VIAF cluster, etc.). */
export function candidateLinks(
  candidate: DisambiguationCandidate,
  options: CandidateLinkOptions = {},
): CandidateLink[] {
  const wikiSite = options.wikiSite ?? 'enwiki';
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
      add(
        'wikipedia',
        WIKIPEDIA_ARTICLE_URL(qid, wikiSite),
        wikiSite === 'zhwiki' ? `中文維基百科 (${qid})` : `Wikipedia (${qid})`,
      );
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
  for (const text of texts) {
    if (!text) continue;
    const cbdb = extractCbdbId(text);
    if (cbdb) {
      const key = `CBDB\0${cbdb}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ type: 'CBDB', value: cbdb });
      }
    }
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

  const items = doc.getElementsByTagName(listTag);
  const out: DisambiguationCandidate[] = [];
  for (let i = 0; i < items.length; i++) {
    const el = items.item(i)!;
    if (!entityNameMatches(el, surface)) continue;
    const localId = el.getAttribute('xml:id') ?? '';
    const idnos = Array.from(el.getElementsByTagName('idno'));
    const authorityIds: AuthorityId[] = idnos.map((idno) => ({
      type: idno.getAttribute('type') ?? 'unknown',
      value: idno.textContent?.trim() ?? '',
    }));
    out.push({
      id: localId || `local-${i}`,
      label: el.textContent?.trim() || surface,
      description: el.getElementsByTagName('note')[0]?.textContent ?? undefined,
      sources: ['entity-file'],
      localEntityId: localId || undefined,
      authorityIds,
      fromEntityFile: true,
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

export async function fetchLiveCandidates(
  tag: string,
  surface: string,
  cache: AuthorityCache,
  enabledAuthorities: Array<keyof typeof AUTHORITY_MAP>,
  forceRefresh = false,
): Promise<DisambiguationCandidate[]> {
  const entityType = TAG_TO_ENTITY_TYPE[tag] ?? 'person';
  const results: DisambiguationCandidate[] = [];

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

    for (const match of matches) {
      results.push({
        id: match.uri,
        label: match.label,
        description: match.description,
        sources: [name],
        uri: match.uri,
        authorityIds: dedupeAuthorityIds(
          authorityIdsFromCrossRefs([{ type: name, value: match.uri }], match.description),
        ),
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
): Promise<DisambiguationCandidate[]> {
  const local = candidatesFromEntityFile(entitiesDoc, tag, surface);
  const live = await fetchLiveCandidates(tag, surface, cache, enabledAuthorities, forceRefresh);
  return collapseCrossAuthorityCandidates(
    mergeCandidates([local, live]).map(enrichCandidateCrossRefs),
  );
}

export interface ResolveEntityInput {
  kind: EntityKind;
  name: string;
  authorityIds?: AuthorityId[];
  description?: string;
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
