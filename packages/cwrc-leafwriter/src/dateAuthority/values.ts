import type { EastAsianDateValues } from './types';
import { EMPTY_EAST_ASIAN_DATE_VALUES } from './types';

export function normalizeYearInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed === '元年') return '1';
  const leading = trimmed.match(/^(\d+)/);
  if (leading) return leading[1]!;
  return trimmed;
}

export function formatYearForDisplay(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '1') return '元年';
  return trimmed;
}

export function readEastAsianDateValues(attrs: Record<string, string>): EastAsianDateValues {
  return {
    dynId: attrs.dyn_id?.trim() ?? '',
    rulerId: attrs.ruler_id?.trim() ?? '',
    eraId: attrs.era_id?.trim() ?? '',
    year: attrs.year ? formatYearForDisplay(attrs.year) : '',
    month: attrs.month?.trim() ?? '',
    day: attrs.day?.trim() ?? '',
  };
}

export function eastAsianValuesToAttributes(
  values: EastAsianDateValues,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (values.dynId.trim()) out.dyn_id = values.dynId.trim();
  if (values.rulerId.trim()) out.ruler_id = values.rulerId.trim();
  if (values.eraId.trim()) out.era_id = values.eraId.trim();
  const year = normalizeYearInput(values.year);
  if (year) out.year = year;
  if (values.month.trim()) out.month = values.month.trim();
  if (values.day.trim()) out.day = values.day.trim();
  return out;
}

export function hasEastAsianCalendarContext(values: EastAsianDateValues): boolean {
  return Boolean(values.dynId.trim() || values.rulerId.trim() || values.eraId.trim());
}

export function mergeEastAsianIntoAttributes(
  base: Record<string, string>,
  values: EastAsianDateValues,
): Record<string, string> {
  const next = { ...base };
  for (const name of ['dyn_id', 'ruler_id', 'era_id', 'year', 'month', 'day'] as const) {
    delete next[name];
  }
  return { ...next, ...eastAsianValuesToAttributes(values) };
}

export function emptyEastAsianDateValues(): EastAsianDateValues {
  return { ...EMPTY_EAST_ASIAN_DATE_VALUES };
}
