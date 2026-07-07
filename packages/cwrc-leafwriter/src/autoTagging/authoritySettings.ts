import {
  persistedPacksFromUi,
  uiPacksFromPersisted,
  type AuthorityPackId,
} from './packPaths';
import type { DateFilterMode } from './packLoader';

/** Per-project authority tag-bomb settings (stored in jean-baptiste.project.json). */
export interface AutoTaggingAuthoritySettings {
  packs?: AuthorityPackId[];
  dateFilter?: DateFilterMode;
  yearStart?: number;
  yearEnd?: number;
  /** @deprecated Use {@link dateFilter}. */
  yearFilterEnabled?: boolean;
  /** @deprecated Folded into {@link dateFilter} (`limit` vs `exclude`). */
  hideUndated?: boolean;
}

export const DEFAULT_AUTHORITY_YEAR_RANGE: [number, number] = [25, 220];
export const DEFAULT_AUTHORITY_DATE_FILTER: DateFilterMode = 'limit';

/** Slider bounds shared by the tag-bomb dialog and the disambiguation panel's date filter. */
export const AUTHORITY_YEAR_MIN = -500;
export const AUTHORITY_YEAR_MAX = 2000;

export function defaultAuthorityPacksRecord(
  overrides: Partial<Record<AuthorityPackId, boolean>> = {},
): Record<AuthorityPackId, boolean> {
  return {
    ...uiPacksFromPersisted(),
    'dila-persons': true,
    ...overrides,
  };
}

export function migrateDateFilter(settings?: AutoTaggingAuthoritySettings): DateFilterMode {
  if (settings?.dateFilter) return settings.dateFilter;
  if (settings?.yearFilterEnabled === false) return 'none';
  return 'limit';
}

export function packsRecordFromSettings(
  settings?: AutoTaggingAuthoritySettings,
): Record<AuthorityPackId, boolean> {
  return uiPacksFromPersisted(settings?.packs);
}

export function settingsFromUiState(input: {
  packs: Record<AuthorityPackId, boolean>;
  dateFilter: DateFilterMode;
  yearRange: [number, number];
}): AutoTaggingAuthoritySettings {
  const [yearStart, yearEnd] = input.yearRange;
  return {
    packs: persistedPacksFromUi(input.packs),
    dateFilter: input.dateFilter,
    yearStart: Math.min(yearStart, yearEnd),
    yearEnd: Math.max(yearStart, yearEnd),
  };
}

export function uiStateFromSettings(settings?: AutoTaggingAuthoritySettings): {
  packs: Record<AuthorityPackId, boolean>;
  dateFilter: DateFilterMode;
  yearRange: [number, number];
} {
  const yearStart = settings?.yearStart ?? DEFAULT_AUTHORITY_YEAR_RANGE[0];
  const yearEnd = settings?.yearEnd ?? DEFAULT_AUTHORITY_YEAR_RANGE[1];
  return {
    packs: packsRecordFromSettings(settings),
    dateFilter: migrateDateFilter(settings),
    yearRange: [Math.min(yearStart, yearEnd), Math.max(yearStart, yearEnd)],
  };
}

export function readPersistedAuthoritySettings(): AutoTaggingAuthoritySettings | undefined {
  const raw = window.__leafWriterProject?.getAutoTaggingAuthoritySettings?.();
  if (!raw) return undefined;
  return {
    packs: raw.packs,
    dateFilter: raw.dateFilter,
    yearStart: raw.yearStart,
    yearEnd: raw.yearEnd,
    yearFilterEnabled: raw.yearFilterEnabled,
    hideUndated: raw.hideUndated,
  };
}

export async function persistAuthoritySettings(
  settings: AutoTaggingAuthoritySettings,
): Promise<void> {
  const projectFilePath = window.__leafWriterProject?.getProjectFilePath?.();
  if (!projectFilePath || !window.electronAPI?.updateProjectFileConfig) return;
  await window.electronAPI.updateProjectFileConfig(projectFilePath, {
    autoTaggingAuthority: settings,
  });
  window.__leafWriterProject?.setAutoTaggingAuthoritySettings?.(settings);
}
