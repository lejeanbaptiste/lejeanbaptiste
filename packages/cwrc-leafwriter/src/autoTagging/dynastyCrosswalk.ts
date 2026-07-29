/**
 * Manual crosswalk for dynasty/state labels used as person nationalities.
 *
 * CBDB, DILA, and Wikidata each supply their own free-text dynasty label with
 * no shared id (unlike persons, which do have a cross-authority crosswalk —
 * see `AuthorityCandidate.metadata.crosswalk` in `authority.ts`). Two sources
 * asserting the same real-world dynasty under different names — e.g. CBDB's
 * "三國魏" vs Wikidata's "曹魏" — would otherwise show as two separate,
 * unmerged nationality rows. This table lets the UI recognize known aliases
 * as the same dynasty; anything not listed here simply falls back to exact
 * text matching (unchanged behavior).
 *
 * Seeded with the dynasties most likely to appear from CBDB/DILA/Wikidata for
 * early medieval Chinese biographical data; extend as new mismatches turn up.
 */

export interface DynastyCrosswalkEntry {
  /** Stable id for the canonical dynasty, unrelated to any single authority's own id. */
  id: string;
  /** Preferred display label shown once sources are merged. */
  label: string;
  /** Every known label variant across CBDB/DILA/Wikidata for this dynasty, including `label`. */
  aliases: string[];
}

export const DYNASTY_CROSSWALK: DynastyCrosswalkEntry[] = [
  { id: 'cao-wei', label: '曹魏', aliases: ['曹魏', '三國魏', '魏(曹)', '魏'] },
  { id: 'shu-han', label: '蜀漢', aliases: ['蜀漢', '三國蜀', '蜀(劉)', '蜀'] },
  { id: 'eastern-wu', label: '東吳', aliases: ['東吳', '三國吳', '吳(孫)', '孫吳'] },
  { id: 'western-jin', label: '西晉', aliases: ['西晉', '晉(司馬)'] },
  { id: 'eastern-jin', label: '東晉', aliases: ['東晉'] },
  { id: 'liu-song', label: '劉宋', aliases: ['劉宋', '宋(劉)', '南朝宋'] },
  { id: 'southern-qi', label: '南齊', aliases: ['南齊', '南朝齊', '齊(蕭)'] },
  { id: 'liang', label: '梁', aliases: ['梁', '南朝梁', '梁(蕭)'] },
  { id: 'chen', label: '陳', aliases: ['陳', '南朝陳', '陳(陳)'] },
  { id: 'northern-wei', label: '北魏', aliases: ['北魏', '後魏', '元魏'] },
  { id: 'eastern-wei', label: '東魏', aliases: ['東魏'] },
  { id: 'western-wei', label: '西魏', aliases: ['西魏'] },
  { id: 'northern-qi', label: '北齊', aliases: ['北齊', '北朝齊'] },
  { id: 'northern-zhou', label: '北周', aliases: ['北周'] },
  { id: 'sui', label: '隋', aliases: ['隋'] },
  { id: 'tang', label: '唐', aliases: ['唐'] },
];

const aliasToEntry = new Map<string, DynastyCrosswalkEntry>();
for (const entry of DYNASTY_CROSSWALK) {
  for (const alias of entry.aliases) aliasToEntry.set(alias, entry);
}

/** Canonical grouping key for a dynasty label; unrecognized labels key on themselves. */
export function canonicalDynastyKey(label: string): string {
  const trimmed = label.trim();
  return aliasToEntry.get(trimmed)?.id ?? trimmed;
}

/** Preferred display label once merged; unrecognized labels pass through unchanged. */
export function preferredDynastyLabel(label: string): string {
  const trimmed = label.trim();
  return aliasToEntry.get(trimmed)?.label ?? trimmed;
}
