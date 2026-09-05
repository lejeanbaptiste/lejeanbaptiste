/**
 * Filter Wikidata reconcile hits by entity kind using P31 (instance of) roots.
 * Mirrors wikidata/kind-queries.json in the authority-extraction repo.
 */

import type { EntityKind } from './entities';

/**
 * P31 roots and exclusions per Grognard entity kind. `thing` deliberately has no
 * entry here — it has no clean Wikidata root set (a philosophical concept,
 * say), so it's matched by exclusion instead; see `wikidataQidsExcludingKnownKinds`.
 */
export const WIKIDATA_KIND_RULES: Record<
  Exclude<EntityKind, 'thing'>,
  { instanceOf: string[]; excludeInstanceOf: string[] }
> = {
  person: {
    instanceOf: ['Q5'],
    excludeInstanceOf: [],
  },
  place: {
    instanceOf: [
      'Q618123',
      'Q2221906',
      'Q515',
      'Q532',
      'Q56061',
      'Q82794',
      'Q8502',
      'Q4022',
      'Q23442',
      'Q1248784',
      'Q28739697',
      'Q30234100',
      'Q486972',
      'Q7930989',
    ],
    excludeInstanceOf: ['Q4167410', 'Q13442814'],
  },
  org: {
    instanceOf: [
      'Q43229',
      'Q4830453',
      'Q2385804',
      'Q3918',
      'Q5341295',
      'Q2659904',
      'Q177634',
      'Q7315155',
      'Q15911314',
      'Q11016',
    ],
    excludeInstanceOf: ['Q4167410', 'Q13442814'],
  },
  work: {
    instanceOf: [
      'Q386724',
      'Q7725634',
      'Q571',
      'Q47461344',
      'Q178385',
      'Q17537576',
      'Q87167',
      'Q5185279',
      'Q1261499',
      'Q3331189',
    ],
    excludeInstanceOf: ['Q4167410', 'Q13442814', 'Q17329259'],
  },
  office: {
    instanceOf: [],
    excludeInstanceOf: [],
  },
};

const GLOBAL_EXCLUDE = ['Q4167410', 'Q13442814'];

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const SPARQL_BATCH_SIZE = 40;

export type WikidataFetchFn = (url: string, init?: RequestInit) => Promise<Response>;

interface SparqlBinding {
  item?: { value?: string };
}

interface SparqlResponse {
  results?: { bindings?: SparqlBinding[] };
}

/** Session cache: `${kind}\0${qid}` → matches that kind. */
const kindMatchCache = new Map<string, boolean>();

export function clearWikidataKindCacheForTests(): void {
  kindMatchCache.clear();
}

function cacheKey(kind: EntityKind, qid: string): string {
  return `${kind}\0${qid}`;
}

function qidFromSparqlUri(uri: string): string | null {
  const match = uri.match(/\/(Q\d+)$/i);
  return match ? match[1]!.toUpperCase() : null;
}

/** Build SPARQL that returns Q-ids matching a kind (P31/P279* against configured roots). */
export function buildKindFilterSparql(qids: string[], kind: Exclude<EntityKind, 'thing'>): string {
  const rules = WIKIDATA_KIND_RULES[kind];
  const itemValues = qids.map((q) => `wd:${q}`).join(' ');
  const rootValues = rules.instanceOf.map((q) => `wd:${q}`).join(' ');
  const exclude = [...new Set([...GLOBAL_EXCLUDE, ...rules.excludeInstanceOf])];
  const excludeValues = exclude.map((q) => `wd:${q}`).join(' ');

  return `
SELECT DISTINCT ?item WHERE {
  VALUES ?item { ${itemValues} }
  VALUES ?root { ${rootValues} }
  ?item wdt:P31/wdt:P279* ?root .
  FILTER NOT EXISTS {
    VALUES ?ex { ${excludeValues} }
    ?item wdt:P31/wdt:P279* ?ex .
  }
}
`.trim();
}

/**
 * Build SPARQL that returns Q-ids matching NONE of the other kinds' P31/P279*
 * roots — the `thing` filter. A `thing` (e.g. a philosophical concept) has no
 * clean positive root set of its own, so it's identified by ruling out
 * person/place/org/work instead. `office` is skipped: its root set is already
 * empty, so it would contribute nothing to the exclusion.
 */
export function buildExclusionFilterSparql(qids: string[]): string {
  const itemValues = qids.map((q) => `wd:${q}`).join(' ');
  const excludeRoots = [
    ...new Set(
      (['person', 'place', 'org', 'work'] as const).flatMap(
        (kind) => WIKIDATA_KIND_RULES[kind].instanceOf,
      ),
    ),
  ];
  const excludeValues = excludeRoots.map((q) => `wd:${q}`).join(' ');

  return `
SELECT DISTINCT ?item WHERE {
  VALUES ?item { ${itemValues} }
  FILTER NOT EXISTS {
    VALUES ?root { ${excludeValues} }
    ?item wdt:P31/wdt:P279* ?root .
  }
}
`.trim();
}

export function parseKindFilterSparqlResponse(data: SparqlResponse): Set<string> {
  const matched = new Set<string>();
  for (const binding of data.results?.bindings ?? []) {
    const uri = binding.item?.value;
    if (!uri) continue;
    const qid = qidFromSparqlUri(uri);
    if (qid) matched.add(qid);
  }
  return matched;
}

async function runSparqlQuery(query: string, fetchImpl: WikidataFetchFn): Promise<Set<string>> {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'Grognard/1.0 (disambiguation; https://github.com/cwrc/leaf-writer)',
    },
  });
  if (!response.ok) {
    throw new Error(`Wikidata SPARQL failed (${response.status})`);
  }
  const data = (await response.json()) as SparqlResponse;
  return parseKindFilterSparqlResponse(data);
}

/** Shared batching/caching driver for both the allowlist and exclusion filters. */
async function batchedKindQuery(
  qids: string[],
  cacheKind: EntityKind,
  buildQuery: (batch: string[]) => string,
  fetchImpl: WikidataFetchFn,
): Promise<Set<string>> {
  const unique = [...new Set(qids.map((q) => q.toUpperCase()))];
  const matched = new Set<string>();

  for (const qid of unique) {
    if (kindMatchCache.get(cacheKey(cacheKind, qid)) === true) matched.add(qid);
  }

  const pending = unique.filter((qid) => !kindMatchCache.has(cacheKey(cacheKind, qid)));
  if (pending.length === 0) return matched;

  for (let i = 0; i < pending.length; i += SPARQL_BATCH_SIZE) {
    const batch = pending.slice(i, i + SPARQL_BATCH_SIZE);
    let batchMatched: Set<string>;
    try {
      batchMatched = await runSparqlQuery(buildQuery(batch), fetchImpl);
    } catch {
      for (const qid of batch) {
        kindMatchCache.set(cacheKey(cacheKind, qid), false);
      }
      continue;
    }
    for (const qid of batch) {
      const ok = batchMatched.has(qid);
      kindMatchCache.set(cacheKey(cacheKind, qid), ok);
      if (ok) matched.add(qid);
    }
  }

  return matched;
}

/**
 * Return the subset of Q-ids whose Wikidata type matches the requested entity kind.
 * Uses Wikidata Query Service with subclass closure (P31/P279*).
 */
export async function wikidataQidsMatchingKind(
  qids: string[],
  kind: Exclude<EntityKind, 'thing'>,
  fetchImpl: WikidataFetchFn = fetch,
): Promise<Set<string>> {
  return batchedKindQuery(qids, kind, (batch) => buildKindFilterSparql(batch, kind), fetchImpl);
}

/**
 * Return the subset of Q-ids whose Wikidata type matches NONE of the other
 * kinds' roots — the `thing` filter (see `buildExclusionFilterSparql`).
 */
export async function wikidataQidsExcludingKnownKinds(
  qids: string[],
  fetchImpl: WikidataFetchFn = fetch,
): Promise<Set<string>> {
  return batchedKindQuery(qids, 'thing', buildExclusionFilterSparql, fetchImpl);
}
