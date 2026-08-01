/** Fetch Wikidata P800 (notable work) claims — labels only; mint/link is SQLite-side. */

import { preferredLabelForLang, wikidataLabelsByQid } from './disambiguationMatch';
import type { WikidataFetchFn } from './wikidataDates';

interface WikidataClaimSnak {
  mainsnak?: {
    snaktype?: string;
    datavalue?: { value?: { id?: string } };
  };
}

interface WikidataEntitiesResponse {
  entities?: Record<string, { claims?: Record<string, WikidataClaimSnak[]> }>;
}

export interface WikidataPersonWork {
  qid: string;
  label: string;
}

const workQidsFromClaims = (claims: WikidataClaimSnak[] | undefined): string[] => {
  const seen = new Set<string>();
  return (claims ?? []).flatMap((claim) => {
    if (claim.mainsnak?.snaktype !== 'value') return [];
    const qid = claim.mainsnak.datavalue?.value?.id;
    if (!qid || seen.has(qid)) return [];
    seen.add(qid);
    return [qid];
  });
};

export async function fetchWikidataPersonWorks(
  qid: string,
  fetchImpl: WikidataFetchFn = fetch,
  projectLang?: string | null,
): Promise<WikidataPersonWork[]> {
  const response = await fetchImpl(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`,
  );
  if (!response.ok) return [];
  const data = (await response.json()) as WikidataEntitiesResponse;
  const qids = workQidsFromClaims(data.entities?.[qid]?.claims?.['P800']);
  if (qids.length === 0) return [];
  const labelsByQid = await wikidataLabelsByQid(qids, fetchImpl);
  return qids.map((workQid) => {
    const labels = labelsByQid.get(workQid.toUpperCase()) ?? {};
    return {
      qid: workQid,
      label: preferredLabelForLang(labels, projectLang) ?? labels.en ?? workQid,
    };
  });
}
