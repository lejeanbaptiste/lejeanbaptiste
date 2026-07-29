/** Fetch the place of birth (P19) claim from Wikidata for a Q-id. */

import type { WikidataFetchFn } from './wikidataDates';
import { preferredLabelForLang, wikidataLabelsByQid } from './disambiguationMatch';

export interface WikidataPlaceOfBirth {
  /** Wikidata entity URI, e.g. "https://www.wikidata.org/entity/Q123". */
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

/** Fetch P19 and resolve its label in the project language where available. */
export async function fetchWikidataPlaceOfBirth(
  qid: string,
  fetchImpl: WikidataFetchFn = fetch,
  projectLang?: string | null,
): Promise<WikidataPlaceOfBirth[] | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`;
  const response = await fetchImpl(url);
  if (!response.ok) return null;

  const data = (await response.json()) as WikidataEntitiesResponse;
  const claims = data.entities?.[qid]?.claims?.['P19'] ?? [];
  const targetQids = claims
    .filter((claim) => claim.mainsnak?.snaktype === 'value')
    .map((claim) => claim.mainsnak?.datavalue?.value?.id)
    .filter((id): id is string => Boolean(id));
  if (targetQids.length === 0) return null;

  const labelsByQid = await wikidataLabelsByQid(targetQids, fetchImpl);
  return targetQids.map((targetQid) => {
    const labels = labelsByQid.get(targetQid.toUpperCase()) ?? {};
    const label =
      preferredLabelForLang(labels, projectLang) ??
      labels['en'] ??
      Object.values(labels)[0] ??
      targetQid;
    return { canonicalId: `https://www.wikidata.org/entity/${targetQid}`, label };
  });
}
