/** Resolve a pasted URL into an {@link AuthorityId} for entities with no reconcilable match (e.g. mythological figures). */
import { extractViafId, extractWikidataId, WIKIDATA_ITEM_URL } from './disambiguationCandidates';
import type { AuthorityId } from './entities';

export type WikipediaFetchFn = (url: string) => Promise<Response>;

interface WikipediaPagePropsResponse {
  query?: {
    pages?: Record<string, { pageprops?: { wikibase_item?: string } }>;
  };
}

/** Parse `{lang}.wikipedia.org/wiki/{title}` into its API host + decoded page title. */
function parseWikipediaUrl(url: string): { apiHost: string; title: string } | null {
  const match = url.match(/^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/([^?#]+)/i);
  if (!match) return null;
  const [, lang, encodedTitle] = match;
  try {
    return { apiHost: `${lang}.wikipedia.org`, title: decodeURIComponent(encodedTitle!) };
  } catch {
    return null;
  }
}

/** Resolve a Wikipedia article URL to its Wikidata Q-id via the MediaWiki `pageprops` API. */
export async function resolveWikidataQidFromWikipediaUrl(
  url: string,
  fetchImpl?: WikipediaFetchFn,
): Promise<string | null> {
  const parsed = parseWikipediaUrl(url);
  if (!parsed) return null;
  const apiUrl = `https://${parsed.apiHost}/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&titles=${encodeURIComponent(parsed.title)}&format=json&origin=*`;
  const response = await (fetchImpl ?? fetch)(apiUrl);
  if (!response.ok) return null;
  const data = (await response.json()) as WikipediaPagePropsResponse;
  const pages = data.query?.pages ?? {};
  for (const page of Object.values(pages)) {
    const qid = page.pageprops?.wikibase_item;
    if (qid) return qid;
  }
  return null;
}

/** Authority domains with reliable, harvestable structured data — a manual link must resolve to one of these. */
function matchKnownAuthorityDomain(url: string): AuthorityId | null {
  const wikidataId = extractWikidataId(url);
  if (wikidataId && /wikidata\.org/i.test(url)) {
    return { type: 'Wikidata', value: WIKIDATA_ITEM_URL(wikidataId) };
  }
  const viafId = extractViafId(url);
  if (viafId) return { type: 'VIAF', value: `https://viaf.org/viaf/${viafId}` };

  if (/dbpedia\.org/i.test(url)) return { type: 'DBPedia', value: url };
  if (/vocab\.getty\.edu/i.test(url)) return { type: 'Getty', value: url };
  if (/d-nb\.info\/gnd\/|portal\.dnb\.de/i.test(url)) return { type: 'GND', value: url };
  if (/geonames\.org/i.test(url)) return { type: 'Geonames', value: url };

  return null;
}

/**
 * Resolve a pasted URL to an {@link AuthorityId}, accepting only recognized authorities
 * (Wikidata, VIAF, DBPedia, Getty, GND, Geonames) or a Wikipedia article (resolved to its
 * Wikidata Q-id). Returns null for anything else — this is a gate, not a generic-URL store.
 */
export async function resolveManualAuthorityLink(
  url: string,
  fetchImpl?: WikipediaFetchFn,
): Promise<AuthorityId | null> {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const direct = matchKnownAuthorityDomain(trimmed);
  if (direct) return direct;

  if (/wikipedia\.org/i.test(trimmed)) {
    const qid = await resolveWikidataQidFromWikipediaUrl(trimmed, fetchImpl);
    return qid ? { type: 'Wikidata', value: WIKIDATA_ITEM_URL(qid) } : null;
  }

  return null;
}
