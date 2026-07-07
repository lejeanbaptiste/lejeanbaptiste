import type { DateFilterMode } from './packLoader';

/** Per-project disambiguation UI settings (stored in jean-baptiste.project.json). */
export interface DisambiguationSettings {
  /** When true, the disambiguation panel asks the configured model to pre-check candidates. */
  aiCuration?: boolean;
  /** Date-range filter mode for the disambiguation panel's own filter (separate from the tag-bomb one). */
  dateFilter?: DateFilterMode;
  yearStart?: number;
  yearEnd?: number;
}

export const DEFAULT_DISAMBIGUATION_AI_CURATION = true;

/** Unlike the tag-bomb dialog (defaults to 'limit'), the disambiguation panel starts unfiltered. */
export const DEFAULT_DISAMBIGUATION_DATE_FILTER: DateFilterMode = 'none';
export const DEFAULT_DISAMBIGUATION_YEAR_RANGE: [number, number] = [25, 220];

export function aiCurationFromSettings(settings?: DisambiguationSettings): boolean {
  return settings?.aiCuration ?? DEFAULT_DISAMBIGUATION_AI_CURATION;
}

export function dateFilterFromSettings(settings?: DisambiguationSettings): DateFilterMode {
  return settings?.dateFilter ?? DEFAULT_DISAMBIGUATION_DATE_FILTER;
}

export function yearRangeFromSettings(settings?: DisambiguationSettings): [number, number] {
  const start = settings?.yearStart ?? DEFAULT_DISAMBIGUATION_YEAR_RANGE[0];
  const end = settings?.yearEnd ?? DEFAULT_DISAMBIGUATION_YEAR_RANGE[1];
  return [Math.min(start, end), Math.max(start, end)];
}

export function readPersistedDisambiguationSettings(): DisambiguationSettings | undefined {
  const raw = window.__leafWriterProject?.getDisambiguationSettings?.();
  if (!raw) return undefined;
  return {
    aiCuration:
      typeof raw.aiCuration === 'boolean' ? raw.aiCuration : DEFAULT_DISAMBIGUATION_AI_CURATION,
    dateFilter: raw.dateFilter,
    yearStart: raw.yearStart,
    yearEnd: raw.yearEnd,
  };
}

export async function persistDisambiguationSettings(
  settings: DisambiguationSettings,
): Promise<void> {
  const projectFilePath = window.__leafWriterProject?.getProjectFilePath?.();
  if (!projectFilePath || !window.electronAPI?.updateProjectFileConfig) return;
  await window.electronAPI.updateProjectFileConfig(projectFilePath, {
    disambiguation: settings,
  });
  window.__leafWriterProject?.setDisambiguationSettings?.(settings);
}

/**
 * Persist just the date-filter portion, read-modify-write so an unrelated field
 * (e.g. `aiCuration`, saved from a different call site) isn't clobbered.
 */
export async function persistDisambiguationDateFilter(
  dateFilter: DateFilterMode,
  yearRange: [number, number],
): Promise<void> {
  const current = readPersistedDisambiguationSettings();
  await persistDisambiguationSettings({
    ...current,
    dateFilter,
    yearStart: Math.min(...yearRange),
    yearEnd: Math.max(...yearRange),
  });
}
