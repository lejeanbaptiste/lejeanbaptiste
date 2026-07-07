/**
 * Filter Wikidata reconcile hits by entity kind using P31 (instance of) roots.
 * Mirrors wikidata/kind-queries.json in the authority-extraction repo.
 */

import type { EntityKind } from './entities';

/** P31 roots and exclusions per LJB entity kind. */
export const WIKIDATA_KIND_RULES: Record<
  EntityKind,
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
};

const GLOBAL_EXCLUDE = ['Q4167410', 'Q13442814'];

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const SPARQL_BATCH_SIZE = 40;

export type WikidataFetchFn = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

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
export function buildKindFilterSparql(qids: string[], kind: EntityKind): string {
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

async function queryKindBatch(
  qids: string[],
  kind: EntityKind,
  fetchImpl: WikidataFetchFn,
): Promise<Set<string>> {
  const query = buildKindFilterSparql(qids, kind);
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'LeJeanBaptiste/1.0 (disambiguation; https://github.com/cwrc/leaf-writer)',
    },
  });
  if (!response.ok) {
    throw new Error(`Wikidata SPARQL failed (${response.status})`);
  }
  const data = (await response.json()) as SparqlResponse;
  return parseKindFilterSparqlResponse(data);
}

/**
 * Return the subset of Q-ids whose Wikidata type matches the requested entity kind.
 * Uses Wikidata Query Service with subclass closure (P31/P279*).
 */
export async function wikidataQidsMatchingKind(
  qids: string[],
  kind: EntityKind,
  fetchImpl: WikidataFetchFn = fetch,
): Promise<Set<string>> {
  const unique = [...new Set(qids.map((q) => q.toUpperCase()))];
  const matched = new Set<string>();

  for (const qid of unique) {
    if (kindMatchCache.get(cacheKey(kind, qid)) === true) matched.add(qid);
  }

  const pending = unique.filter((qid) => !kindMatchCache.has(cacheKey(kind, qid)));
  if (pending.length === 0) return matched;

  for (let i = 0; i < pending.length; i += SPARQL_BATCH_SIZE) {
    const batch = pending.slice(i, i + SPARQL_BATCH_SIZE);
    let batchMatched: Set<string>;
    try {
      batchMatched = await queryKindBatch(batch, kind, fetchImpl);
    } catch {
      for (const qid of batch) {
        kindMatchCache.set(cacheKey(kind, qid), false);
      }
      continue;
    }
    for (const qid of batch) {
      const ok = batchMatched.has(qid);
      kindMatchCache.set(cacheKey(kind, qid), ok);
      if (ok) matched.add(qid);
    }
  }

  return matched;
}
