/** Fetch a work date (P577 publication date, falling back to P571 inception) and author(s) (P50). */
import { parseWikidataYear } from './wikidataDates';
import { resolveEntityInDocument } from './disambiguationCandidates';
import { setUserWorkAuthors, setUserWorkDate } from './entityOps';
import { addEntityName } from './entityOps';
import { autoRomanize } from '../utilities/romanize';

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
  titles: { language: string; label: string }[];
}

export interface WikidataWorkEnrichment {
  publicationYear?: number;
  authors: { qid: string; label: string; entityId: string }[];
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

function normalizeLabelLanguages(desktopLanguage?: string | null): string[] {
  const languages = ['en', desktopLanguage?.trim().toLowerCase()].filter(
    (language): language is string => Boolean(language),
  );
  return [
    ...new Set(
      languages.flatMap((language) => {
        const normalized = language.replace('_', '-');
        const base = normalized.split('-')[0]!;
        return normalized === base ? [base] : [normalized, base];
      }),
    ),
  ];
}

/** Fetch P577 (publication date), P571 (inception), and P50 (author) for a work Q-id. */
export async function fetchWikidataWorkDetails(
  qid: string,
  fetchImpl: WikidataFetchFn = fetch,
  desktopLanguage?: string | null,
): Promise<WikidataWorkDetails | null> {
  const labelLanguages = normalizeLabelLanguages(desktopLanguage);
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims|labels&languages=${labelLanguages.join('|')}&format=json&origin=*`;
  const response = await fetchImpl(url);
  if (!response.ok) return null;

  const data = (await response.json()) as WikidataEntitiesResponse;
  const entity = data.entities?.[qid];
  if (!entity) return null;

  const claims = entity.claims ?? {};
  // P577 is preferred when present; historical works such as books often expose
  // their date only as P571 (inception) on Wikidata.
  const publicationYear =
    firstYearFromClaims(claims['P577']) ?? firstYearFromClaims(claims['P571']) ?? undefined;
  const authorQids = authorQidsFromClaims(claims['P50']);

  if (publicationYear == null && authorQids.length === 0) return null;

  const labels = await fetchLabels(authorQids, fetchImpl);
  const authors = authorQids.map((authorQid) => ({
    qid: authorQid,
    label: labels.get(authorQid) ?? authorQid,
  }));
  const titles = labelLanguages.flatMap((language) => {
    const label = entity.labels?.[language]?.value;
    return label ? [{ language, label }] : [];
  });

  return { publicationYear, authors, titles };
}

/**
 * Fetch and persist a work's Wikidata publication date and P50 authors.
 * Author entities are reused by their Wikidata id, or minted when absent.
 */
export async function enrichWikidataWorkEntity(
  doc: Document,
  workEntityId: string,
  qid: string,
  projectLang?: string | null,
  desktopLanguage?: string | null,
  fetchImpl: WikidataFetchFn = fetch,
): Promise<WikidataWorkEnrichment | null> {
  const details = await fetchWikidataWorkDetails(qid, fetchImpl, desktopLanguage);
  if (!details) return null;
  const authors = details.authors.map((author) => ({
    ...author,
    entityId: resolveEntityInDocument(doc, {
      kind: 'person',
      name: author.label,
      romanizedName: autoRomanize(author.label, projectLang ?? null) ?? undefined,
      nameLang: projectLang ?? undefined,
      authorityIds: [{ type: 'Wikidata', value: author.qid }],
    }),
  }));
  setUserWorkAuthors(
    doc,
    workEntityId,
    authors.map((author) => ({ name: author.label, key: author.entityId })),
  );
  for (const title of details.titles) {
    addEntityName(doc, workEntityId, title.label, {
      type: 'translation',
      lang: title.language,
      origin: 'authority',
      source: 'Wikidata',
    });
  }
  if (details.publicationYear != null) {
    setUserWorkDate(doc, workEntityId, details.publicationYear);
  }
  return { publicationYear: details.publicationYear, authors };
}
