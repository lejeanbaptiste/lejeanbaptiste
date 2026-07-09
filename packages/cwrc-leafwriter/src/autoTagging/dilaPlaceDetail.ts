/**
 * Fetch and parse a DILA place record for its 備註/朝代 fields.
 *
 * The GitHub TEI export (packs/dila/places.ndjson) is mostly free-text notes
 * with no structured date range for the vast majority of places (see
 * authority-databases-planning notes). The live record page does carry
 * structured 備註/朝代 fields, but only by id — there is no string search API,
 * so this is only ever called for a DILA place id that already surfaced from
 * a local pack match.
 */

export interface DilaPlaceDetail {
  remark?: string;
  dynasty?: string;
  startYear?: number;
  endYear?: number;
}

/** Value text for a labeled `<span id="wiki_X">Label：</span>value<br/>` field. */
function fieldValue(html: string, spanId: string): string | undefined {
  const re = new RegExp(`<span[^>]*id=["']${spanId}["'][^>]*>[^<]*</span>([^<]*)`);
  const match = re.exec(html);
  const value = match?.[1]?.trim();
  return value || undefined;
}

/** Extract a "(start ~ end)" year range from DILA remark prose, e.g. "（317 ~ 420）郡級行政中心所在地". */
export function yearRangeFromDilaText(text: string | undefined): { startYear: number; endYear: number } | undefined {
  if (!text) return undefined;
  const match = /[（(]\s*([+-]?\d{1,4})\s*[~～\-–]\s*([+-]?\d{1,4})\s*[）)]/.exec(text);
  if (!match) return undefined;
  const startYear = parseInt(match[1]!, 10);
  const endYear = parseInt(match[2]!, 10);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return undefined;
  return { startYear, endYear };
}

/** Parse the record page HTML from `place/search.php?code=<id>`. */
export function parseDilaPlaceDetailHtml(html: string): DilaPlaceDetail {
  const remark = fieldValue(html, 'wiki_Class_id');
  const dynasty = fieldValue(html, 'wiki_Dynasty');
  const years = yearRangeFromDilaText(remark);
  return { remark, dynasty, startYear: years?.startYear, endYear: years?.endYear };
}

export type DilaFetchFn = (url: string) => Promise<Response>;

/** Fetch and parse the 備註/朝代 fields for a DILA place id (e.g. "PL000000029418"). */
export async function fetchDilaPlaceDetail(
  id: string,
  fetchImpl: DilaFetchFn = fetch,
): Promise<DilaPlaceDetail | null> {
  const url = `https://authority.dila.edu.tw/place/search.php?code=${encodeURIComponent(id)}`;
  const response = await fetchImpl(url);
  if (!response.ok) return null;
  const html = await response.text();
  return parseDilaPlaceDetailHtml(html);
}
