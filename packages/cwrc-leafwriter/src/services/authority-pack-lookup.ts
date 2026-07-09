/**
 * Entity-lookup services backed by installed authority packs (CBDB, DILA,
 * NDL): the same ndjson assets the auto-tagger uses, so lookup works offline
 * and matches every search-string variant a pack knows (alternate names,
 * NDL yomi readings, etc.).
 */
import type {
  AuthorityLookupParams,
  AuthorityLookupResult,
  AuthorityService,
  NamedEntityType,
} from '../types';
import { AUTHORITY_PACKS, type AuthorityPackId } from '../autoTagging/packPaths';

interface PackRow {
  authorityId?: string;
  primaryName?: string;
  searchStrings?: string[];
  metadata?: {
    dynasty?: string;
    startYear?: number;
    endYear?: number;
    description?: string;
    pinyin?: string;
    yomi?: string;
    translation?: string;
  };
}

const MAX_RESULTS = 10;

type PackSource = 'cbdb' | 'dila' | 'ndl';

const SERVICES: {
  source: PackSource;
  id: string;
  name: string;
  url: string;
  packs: Partial<Record<NamedEntityType, AuthorityPackId>>;
}[] = [
  {
    source: 'cbdb',
    id: 'cbdb',
    name: 'CBDB',
    url: 'https://projects.iq.harvard.edu/cbdb',
    packs: { person: 'cbdb-persons', place: 'cbdb-places' },
  },
  {
    source: 'dila',
    id: 'dila',
    name: 'DILA',
    url: 'https://authority.dila.edu.tw/',
    packs: { person: 'dila-persons', place: 'dila-places' },
  },
  {
    source: 'ndl',
    id: 'ndl',
    name: 'NDL',
    url: 'https://id.ndl.go.jp/auth/ndla',
    packs: {
      person: 'ndl-persons',
      place: 'ndl-places',
      organization: 'ndl-orgs',
      work: 'ndl-works',
      citation: 'ndl-works',
    },
  },
];

/**
 * Canonical record URL, parseable back to (authority, id) by
 * `parseAuthorityUri` so resolve-on-select recognizes the pick.
 */
export function packResultUri(source: PackSource, entityType: NamedEntityType, id: string): string {
  switch (source) {
    case 'cbdb':
      return entityType === 'place'
        ? `https://cbdb.fas.harvard.edu/place?id=${id}`
        : `https://cbdb.fas.harvard.edu/person?id=${id}`;
    case 'dila':
      return entityType === 'place'
        ? `https://authority.dila.edu.tw/place/search.php?aid=${id}`
        : `https://authority.dila.edu.tw/person/search.php?aid=${id}`;
    case 'ndl':
      // Assumes name authorities (ndlna); refine if a pack ships ndlsh ids.
      return `https://id.ndl.go.jp/auth/ndlna/${id}`;
  }
}

function describeRow(row: PackRow): string | undefined {
  const meta = row.metadata;
  if (!meta) return undefined;
  if (meta.description) return meta.description;
  const years =
    meta.startYear != null || meta.endYear != null
      ? `${meta.startYear ?? '?'}–${meta.endYear ?? '?'}`
      : undefined;
  const parts = [meta.dynasty, years, meta.pinyin ?? meta.yomi, meta.translation].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

/**
 * Scan pack ndjson for rows whose search strings match the query (CJK-style
 * mutual substring). Exact matches rank first. Lines are substring-prefiltered
 * before JSON parsing, so scanning a large pack per search stays cheap.
 */
export function searchPackContent(
  content: string,
  source: PackSource,
  entityType: NamedEntityType,
  query: string,
  limit: number = MAX_RESULTS,
): AuthorityLookupResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const exact: AuthorityLookupResult[] = [];
  const partial: AuthorityLookupResult[] = [];
  const seen = new Set<string>();

  for (const line of content.split('\n')) {
    if (exact.length >= limit) break;
    if (!line.trim()) continue;
    // Prefilter before JSON.parse: a `query ⊆ name` hit contains the query
    // verbatim; a `name ⊆ query` hit (e.g. stored 攸之 under query 沈攸之)
    // must contain some 2-char slice of the query.
    let cheapHit = line.includes(trimmed);
    if (!cheapHit) {
      for (let i = 0; i + 2 <= trimmed.length && !cheapHit; i++) {
        cheapHit = line.includes(trimmed.slice(i, i + 2));
      }
    }
    if (!cheapHit) continue;
    let row: PackRow;
    try {
      row = JSON.parse(line) as PackRow;
    } catch {
      continue;
    }
    if (!row.authorityId || !row.primaryName) continue;

    const strings = row.searchStrings?.length ? row.searchStrings : [row.primaryName];
    const isExact = strings.some((s) => s === trimmed);
    const isPartial =
      !isExact && strings.some((s) => s.includes(trimmed) || trimmed.includes(s));
    if (!isExact && !isPartial) continue;

    const uri = packResultUri(source, entityType, String(row.authorityId));
    if (seen.has(uri)) continue;
    seen.add(uri);

    (isExact ? exact : partial).push({
      label: row.primaryName,
      description: describeRow(row),
      uri,
    });
  }

  return [...exact, ...partial].slice(0, limit);
}

const ENTITY_TYPE_TAG: Partial<Record<NamedEntityType, string>> = {
  person: 'persName',
  place: 'placeName',
  organization: 'orgName',
  work: 'title',
  citation: 'title',
};

/** Restrict a pack list to those holding the given entity type (by pack tag). */
export function packIdsForEntityType(
  packIds: AuthorityPackId[],
  entityType: NamedEntityType,
): AuthorityPackId[] {
  const tag = ENTITY_TYPE_TAG[entityType];
  if (!tag) return [];
  return packIds.filter(
    (id) => AUTHORITY_PACKS.find((spec) => spec.id === id)?.defaultTag === tag,
  );
}

/** Session-lifetime cache of pack contents (packs only change on reinstall). */
const packContentCache = new Map<AuthorityPackId, Promise<string>>();

export function readPackCached(packId: AuthorityPackId): Promise<string> {
  const readPack = window.electronAPI?.authorityPackRead;
  if (!readPack) return Promise.reject(new Error('Authority packs unavailable'));
  let cached = packContentCache.get(packId);
  if (!cached) {
    cached = readPack(packId).catch((error: unknown) => {
      packContentCache.delete(packId);
      throw error;
    });
    packContentCache.set(packId, cached);
  }
  return cached;
}

async function installedPackIds(): Promise<Set<AuthorityPackId>> {
  const statuses = (await window.electronAPI?.authorityPackStatuses?.()) ?? [];
  return new Set(statuses.filter((status) => status.installed).map((status) => status.id));
}

function makeSearch(spec: (typeof SERVICES)[number]) {
  return async ({ query, entityType }: AuthorityLookupParams): Promise<AuthorityLookupResult[]> => {
    const packId = spec.packs[entityType];
    if (!packId) return [];
    if (!(await installedPackIds()).has(packId)) return [];
    const content = await readPackCached(packId);
    return searchPackContent(content, spec.source, entityType, query);
  };
}

/** Pack-backed lookup services (desktop only; empty when the bridge is missing). */
export function authorityPackLookupServices(): AuthorityService[] {
  if (typeof window === 'undefined' || !window.electronAPI?.authorityPackRead) return [];

  return SERVICES.map((spec) => ({
    id: spec.id,
    name: spec.name,
    url: spec.url,
    description: `${spec.name} authority (installed local packs)`,
    entityTypes: new Map(
      (Object.keys(spec.packs) as NamedEntityType[]).map((name) => [name, { name }]),
    ),
    isLocal: true,
    search: makeSearch(spec),
  }));
}
