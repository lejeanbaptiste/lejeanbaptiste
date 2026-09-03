/**
 * BDRC / BUDA resource ids and stable URLs.
 *
 * Ids are typed by prefix (P person, G place, W/WA/MW works, UT etext, R role, …).
 * The `?s=` query on library.bdrc.io is search-session UI state — never keep it.
 */

/** Wikidata Q-ids are not BDRC. Any other `Letter + rest` token is a BDRC id. */
const BDRC_ID = /^[A-Za-z][A-Za-z0-9._-]*$/;

/** Bare BDRC id (`P1KG18539`). Accepts `bdr:` prefixes and BUDA / PDI URLs. */
export function normalizeBdrcId(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;
  const fromUrl = raw.match(
    /(?:library\.bdrc\.io\/show\/bdr:|purl\.bdrc\.io\/resource\/)([A-Za-z][A-Za-z0-9._-]*)/i,
  )?.[1];
  const candidate = (fromUrl ?? raw.replace(/^bdr:/i, '')).replace(/\?.*$/, '');
  if (!BDRC_ID.test(candidate)) return null;
  if (/^Q\d+$/i.test(candidate)) return null;
  return candidate;
}

export function extractBdrcId(text: string): string | null {
  return normalizeBdrcId(text);
}

/** Human-facing BUDA record page. */
export const BDRC_SHOW_URL = (id: string) => {
  const bare = normalizeBdrcId(id) ?? id.replace(/^bdr:/i, '');
  return `https://library.bdrc.io/show/bdr:${bare}`;
};

/** Linked-data PDI URL (content negotiation). Same id space as the show page. */
export const BDRC_PURL = (id: string) => {
  const bare = normalizeBdrcId(id) ?? id.replace(/^bdr:/i, '');
  return `https://purl.bdrc.io/resource/${bare}`;
};
