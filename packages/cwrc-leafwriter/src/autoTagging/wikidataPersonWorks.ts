/** Fetch Wikidata P800 (notable work) claims and place authorship on work entities. */

import { preferredLabelForLang, wikidataLabelsByQid } from './disambiguationMatch';
import { resolveEntityInDocument } from './disambiguationCandidates';
import { appendAuthorityWorkAuthor } from './entityOps';
import { findEntity } from './entities';
import { enrichWikidataWorkEntity } from './wikidataWorkDetails';
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

export interface WikidataPersonWorksEnrichment {
  works: { qid: string; label: string; entityId: string }[];
  authorsAdded: number;
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

/** Resolve P800 items and add the person as an authority-backed work author. */
export async function enrichWikidataPersonWorks(
  doc: Document,
  personEntityId: string,
  qid: string,
  projectLang?: string | null,
  desktopLanguage?: string | null,
  fetchImpl: WikidataFetchFn = fetch,
): Promise<WikidataPersonWorksEnrichment | null> {
  const details = await fetchWikidataPersonWorks(qid, fetchImpl, projectLang);
  if (details.length === 0) return null;
  const person = findEntity(doc, personEntityId);
  const personName =
    person?.getElementsByTagName('persName')[0]?.textContent?.trim() ?? personEntityId;
  const works: WikidataPersonWorksEnrichment['works'] = [];
  let authorsAdded = 0;
  for (const work of details) {
    const entityId = resolveEntityInDocument(doc, {
      kind: 'work',
      name: work.label,
      authorityIds: [{ type: 'Wikidata', value: work.qid }],
      authoritySource: `Wikidata:${work.qid}`,
    });
    works.push({ ...work, entityId });
    await enrichWikidataWorkEntity(
      doc,
      entityId,
      work.qid,
      projectLang,
      desktopLanguage,
      fetchImpl,
    ).catch(() => null);
    if (
      appendAuthorityWorkAuthor(doc, entityId, {
        name: personName,
        ref: personEntityId,
      })
    ) {
      authorsAdded++;
    }
  }
  return { works, authorsAdded };
}
