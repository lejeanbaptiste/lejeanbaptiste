/** Fetch nationality/country-of-citizenship (P27) claims from Wikidata for a Q-id. */

import type { WikidataFetchFn } from './wikidataDates';
import { preferredLabelForLang, wikidataLabelsByQid } from './disambiguationMatch';

export interface WikidataNationality {
  /** Wikidata entity URI, e.g. "https://www.wikidata.org/entity/Q148". */
  canonicalId: string;
  label: string;
}

interface WikidataClaimSnak {
  mainsnak?: {
    snaktype?: string;
    datavalue?: { value: { id?: string } };
  };
}

interface WikidataEntitiesResponse {
  entities?: Record<string, { claims?: Record<string, WikidataClaimSnak[]> }>;
}

function targetQidsFromClaims(claims: WikidataClaimSnak[] | undefined): string[] {
  if (!claims) return [];
  const out: string[] = [];
  for (const claim of claims) {
    if (claim.mainsnak?.snaktype !== 'value') continue;
    const id = claim.mainsnak.datavalue?.value?.id;
    if (id) out.push(id);
  }
  return out;
}

/** Fetch P27 (country of citizenship) claims and resolve their labels for a Q-id. */
export async function fetchWikidataNationality(
  qid: string,
  fetchImpl: WikidataFetchFn = fetch,
  projectLang?: string | null,
): Promise<WikidataNationality[] | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`;
  const response = await fetchImpl(url);
  if (!response.ok) return null;

  const data = (await response.json()) as WikidataEntitiesResponse;
  const entity = data.entities?.[qid];
  if (!entity) return null;

  const targetQids = targetQidsFromClaims(entity.claims?.['P27']);
  if (targetQids.length === 0) return null;

  const labelsByQid = await wikidataLabelsByQid(targetQids, fetchImpl);
  return targetQids.map((targetQid) => {
    const labels = labelsByQid.get(targetQid.toUpperCase()) ?? {};
    const label =
      preferredLabelForLang(labels, projectLang) ?? labels['en'] ?? Object.values(labels)[0] ?? targetQid;
    return { canonicalId: `https://www.wikidata.org/entity/${targetQid}`, label };
  });
}
