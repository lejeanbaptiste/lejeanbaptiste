import { pinyin } from 'pinyin-pro';
import type {
  DateAuthorityIndex,
  DynastyAuthorityEntry,
  EraAuthorityEntry,
  RulerAuthorityEntry,
} from './types';

/** Build a lowercase search blob for typeahead (Chinese + simplified + toneless pinyin). */
export function buildSearchText(parts: Array<string | null | undefined>): string {
  const tokens: string[] = [];
  for (const part of parts) {
    if (!part?.trim()) continue;
    tokens.push(part.trim());
    try {
      const py = pinyin(part, { toneType: 'none', type: 'array' }).join('');
      if (py) tokens.push(py);
    } catch {
      // keep label-only search if romanization fails
    }
  }
  return tokens.join(' ').toLowerCase().replace(/\s+/g, '');
}

export function enrichDateAuthorityIndex(raw: {
  dynasties: Array<Omit<DynastyAuthorityEntry, 'searchText'>>;
  rulers: Array<Omit<RulerAuthorityEntry, 'searchText'>>;
  eras: Array<Omit<EraAuthorityEntry, 'searchText'>>;
}): DateAuthorityIndex {
  return {
    dynasties: raw.dynasties.map((entry) => ({
      ...entry,
      searchText: buildSearchText([entry.label]),
    })),
    rulers: raw.rulers.map((entry) => ({
      ...entry,
      searchText: buildSearchText([entry.label, entry.dynLabel]),
    })),
    eras: raw.eras.map((entry) => ({
      ...entry,
      searchText: buildSearchText([entry.label, entry.labelSimp, entry.dynLabel, entry.rulerLabel]),
    })),
  };
}

export function formatYearRange(start?: number | null, end?: number | null): string {
  if (start == null && end == null) return '';
  if (start != null && end != null) return `${start}–${end}`;
  if (start != null) return `${start}–`;
  return `–${end}`;
}

export function dynastySubtitle(entry: DynastyAuthorityEntry): string {
  return formatYearRange(entry.startYear, entry.endYear);
}

export function rulerSubtitle(entry: RulerAuthorityEntry): string {
  const years = formatYearRange(entry.startYear, entry.endYear);
  return years ? `${entry.dynLabel} · ${years}` : entry.dynLabel;
}

export function eraSubtitle(entry: EraAuthorityEntry): string {
  const years = formatYearRange(entry.startYear, entry.endYear);
  const parts = [entry.dynLabel, entry.rulerLabel, years].filter(Boolean);
  return parts.join(' · ');
}

export function matchesSearchText(searchText: string, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/\s+/g, '');
  if (!q) return true;
  return searchText.includes(q);
}

export function filterDynasties(
  entries: DynastyAuthorityEntry[],
  query: string,
): DynastyAuthorityEntry[] {
  return entries.filter((entry) => matchesSearchText(entry.searchText, query));
}

export function filterRulers(
  entries: RulerAuthorityEntry[],
  dynId: string,
  query: string,
): RulerAuthorityEntry[] {
  return entries.filter((entry) => {
    if (dynId && String(entry.dynId) !== dynId) return false;
    return matchesSearchText(entry.searchText, query);
  });
}

export function filterEras(
  entries: EraAuthorityEntry[],
  dynId: string,
  rulerId: string,
  query: string,
): EraAuthorityEntry[] {
  return entries.filter((entry) => {
    if (dynId && String(entry.dynId) !== dynId) return false;
    if (rulerId && String(entry.rulerId) !== rulerId) return false;
    return matchesSearchText(entry.searchText, query);
  });
}
