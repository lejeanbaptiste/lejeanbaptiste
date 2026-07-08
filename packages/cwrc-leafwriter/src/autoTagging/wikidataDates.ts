/** Fetch and format birth/death years from Wikidata for a Q-id (P569/P570). */

export interface WikidataLifespan {
  birthYear?: number;
  deathYear?: number;
}

interface WikidataTimeValue {
  time: string;
  precision: number;
}

interface WikidataClaimSnak {
  mainsnak?: {
    snaktype?: string;
    datavalue?: { value: WikidataTimeValue };
  };
}

interface WikidataEntitiesResponse {
  entities?: Record<
    string,
    {
      claims?: Record<string, WikidataClaimSnak[]>;
      descriptions?: Record<string, { value?: string }>;
    }
  >;
}

/** Wikidata precision 11 = day, 10 = month, 9 = year (anything coarser is still usable as a year). */
const MIN_YEAR_PRECISION = 9;

/** Parse a Wikidata time string (e.g. "+1990-01-01T00:00:00Z" or "-0155-01-01T...") to a signed year. */
export function parseWikidataYear(value: WikidataTimeValue | undefined): number | null {
  if (!value || value.precision < MIN_YEAR_PRECISION) return null;
  const match = value.time.match(/^([+-]\d+)-\d{2}-\d{2}T/);
  if (!match) return null;
  return parseInt(match[1]!, 10);
}

function firstYearFromClaims(claims: WikidataClaimSnak[] | undefined): number | null {
  if (!claims) return null;
  for (const claim of claims) {
    if (claim.mainsnak?.snaktype !== 'value') continue;
    const year = parseWikidataYear(claim.mainsnak.datavalue?.value);
    if (year != null) return year;
  }
  return null;
}

/** Format a signed year as display text, e.g. -155 -> "155 BCE", 1990 -> "1990". */
export function formatWikidataYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BCE` : `${year}`;
}

/** Format a lifespan for a disambiguation description prefix, e.g. "(226–249)", "(d. 253)", "(b. 1990)". */
export function formatLifespan(lifespan: WikidataLifespan): string | undefined {
  const { birthYear, deathYear } = lifespan;
  if (birthYear == null && deathYear == null) return undefined;
  if (birthYear != null && deathYear != null) {
    return `(${formatWikidataYear(birthYear)}–${formatWikidataYear(deathYear)})`;
  }
  if (deathYear != null) return `(d. ${formatWikidataYear(deathYear)})`;
  return `(b. ${formatWikidataYear(birthYear!)})`;
}

/** Prepend a formatted lifespan to a description, unless it already starts with a date-looking prefix. */
export function prefixDescriptionWithLifespan(
  description: string | undefined,
  lifespan: WikidataLifespan | null,
): string | undefined {
  if (!lifespan) return description;
  const prefix = formatLifespan(lifespan);
  if (!prefix) return description;
  if (description && /^[(\d]/.test(description)) return description;
  return description ? `${prefix} ${description}` : prefix;
}

export type WikidataFetchFn = (url: string) => Promise<Response>;

/** Fetch P569 (date of birth) / P570 (date of death) for a Wikidata Q-id. */
export async function fetchWikidataLifespan(
  qid: string,
  fetchImpl: WikidataFetchFn = fetch,
): Promise<WikidataLifespan | null> {
  const summary = await fetchWikidataSummary(qid, fetchImpl);
  if (!summary || (summary.birthYear == null && summary.deathYear == null)) return null;
  return { birthYear: summary.birthYear, deathYear: summary.deathYear };
}

export interface WikidataSummary extends WikidataLifespan {
  /** One-line item description (English, falling back to any available language). */
  description?: string;
}

/** Fetch lifespan (P569/P570) and the one-line description for a Q-id in a single call. */
export async function fetchWikidataSummary(
  qid: string,
  fetchImpl: WikidataFetchFn = fetch,
): Promise<WikidataSummary | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims|descriptions&format=json&origin=*`;
  const response = await fetchImpl(url);
  if (!response.ok) return null;

  const data = (await response.json()) as WikidataEntitiesResponse;
  const entity = data.entities?.[qid];
  if (!entity) return null;

  const claims = entity.claims ?? {};
  const descriptions = entity.descriptions ?? {};
  const description =
    descriptions['en']?.value ?? Object.values(descriptions)[0]?.value ?? undefined;

  return {
    birthYear: firstYearFromClaims(claims['P569']) ?? undefined,
    deathYear: firstYearFromClaims(claims['P570']) ?? undefined,
    description,
  };
}
