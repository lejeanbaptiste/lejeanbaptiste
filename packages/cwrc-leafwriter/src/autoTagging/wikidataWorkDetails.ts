/** Fetch publication date (P577) and author(s) (P50) from Wikidata for a work Q-id. */
import { parseWikidataYear } from './wikidataDates';

interface WikidataTimeValue {
  time: string;
  precision: number;
}

interface WikidataItemValue {
  id: string;
}

interface WikidataClaimSnak {
  mainsnak?: {
    snaktype?: string;
    datavalue?: { value: WikidataTimeValue | WikidataItemValue };
  };
}

interface WikidataEntitiesResponse {
  entities?: Record<
    string,
    {
      claims?: Record<string, WikidataClaimSnak[]>;
      labels?: Record<string, { value?: string }>;
    }
  >;
}

export type WikidataFetchFn = (url: string) => Promise<Response>;

export interface WikidataWorkAuthor {
  qid: string;
  label: string;
}

export interface WikidataWorkDetails {
  publicationYear?: number;
  authors: WikidataWorkAuthor[];
}

function firstYearFromClaims(claims: WikidataClaimSnak[] | undefined): number | null {
  if (!claims) return null;
  for (const claim of claims) {
    if (claim.mainsnak?.snaktype !== 'value') continue;
    const year = parseWikidataYear(claim.mainsnak.datavalue?.value as WikidataTimeValue);
    if (year != null) return year;
  }
  return null;
}

function authorQidsFromClaims(claims: WikidataClaimSnak[] | undefined): string[] {
  if (!claims) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const claim of claims) {
    if (claim.mainsnak?.snaktype !== 'value') continue;
    const id = (claim.mainsnak.datavalue?.value as WikidataItemValue | undefined)?.id;
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

async function fetchLabels(
  qids: string[],
  fetchImpl: WikidataFetchFn,
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  if (qids.length === 0) return labels;
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.join('|')}&props=labels&languages=en&format=json&origin=*`;
  const response = await fetchImpl(url);
  if (!response.ok) return labels;
  const data = (await response.json()) as WikidataEntitiesResponse;
  for (const qid of qids) {
    const label = data.entities?.[qid]?.labels?.['en']?.value;
    if (label) labels.set(qid, label);
  }
  return labels;
}

/** Fetch P577 (publication date) and P50 (author) for a work Q-id. */
export async function fetchWikidataWorkDetails(
  qid: string,
  fetchImpl: WikidataFetchFn = fetch,
): Promise<WikidataWorkDetails | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`;
  const response = await fetchImpl(url);
  if (!response.ok) return null;

  const data = (await response.json()) as WikidataEntitiesResponse;
  const entity = data.entities?.[qid];
  if (!entity) return null;

  const claims = entity.claims ?? {};
  const publicationYear = firstYearFromClaims(claims['P577']) ?? undefined;
  const authorQids = authorQidsFromClaims(claims['P50']);

  if (publicationYear == null && authorQids.length === 0) return null;

  const labels = await fetchLabels(authorQids, fetchImpl);
  const authors = authorQids.map((authorQid) => ({
    qid: authorQid,
    label: labels.get(authorQid) ?? authorQid,
  }));

  return { publicationYear, authors };
}
