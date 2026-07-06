import type { AuthorityPackId } from './packPaths';

/** Per-project authority tag-bomb settings (stored in jean-baptiste.project.json). */
export interface AutoTaggingAuthoritySettings {
  packs?: AuthorityPackId[];
  yearFilterEnabled?: boolean;
  yearStart?: number;
  yearEnd?: number;
  hideUndated?: boolean;
}

export const DEFAULT_AUTHORITY_PACK_SELECTION: Record<AuthorityPackId, boolean> = {
  'cbdb-persons': false,
  'cbdb-places': false,
  'cbdb-offices': false,
  'dila-persons': true,
  'dila-places': false,
  'ndl-persons': false,
  'ndl-works': false,
};

export const DEFAULT_AUTHORITY_YEAR_RANGE: [number, number] = [25, 220];

const ALL_PACK_IDS = Object.keys(DEFAULT_AUTHORITY_PACK_SELECTION) as AuthorityPackId[];

export function packsRecordFromSettings(
  settings?: AutoTaggingAuthoritySettings,
): Record<AuthorityPackId, boolean> {
  const base = { ...DEFAULT_AUTHORITY_PACK_SELECTION };
  if (!settings?.packs?.length) return base;
  for (const id of ALL_PACK_IDS) base[id] = settings.packs.includes(id);
  return base;
}

export function settingsFromUiState(input: {
  packs: Record<AuthorityPackId, boolean>;
  yearFilterEnabled: boolean;
  yearRange: [number, number];
  hideUndated: boolean;
}): AutoTaggingAuthoritySettings {
  const [yearStart, yearEnd] = input.yearRange;
  return {
    packs: ALL_PACK_IDS.filter((id) => input.packs[id]),
    yearFilterEnabled: input.yearFilterEnabled,
    yearStart: Math.min(yearStart, yearEnd),
    yearEnd: Math.max(yearStart, yearEnd),
    hideUndated: input.hideUndated,
  };
}

export function uiStateFromSettings(settings?: AutoTaggingAuthoritySettings): {
  packs: Record<AuthorityPackId, boolean>;
  yearFilterEnabled: boolean;
  yearRange: [number, number];
  hideUndated: boolean;
} {
  const yearStart = settings?.yearStart ?? DEFAULT_AUTHORITY_YEAR_RANGE[0];
  const yearEnd = settings?.yearEnd ?? DEFAULT_AUTHORITY_YEAR_RANGE[1];
  return {
    packs: packsRecordFromSettings(settings),
    yearFilterEnabled: settings?.yearFilterEnabled ?? true,
    yearRange: [Math.min(yearStart, yearEnd), Math.max(yearStart, yearEnd)],
    hideUndated: settings?.hideUndated ?? true,
  };
}

export function readPersistedAuthoritySettings(): AutoTaggingAuthoritySettings | undefined {
  const raw = window.__leafWriterProject?.getAutoTaggingAuthoritySettings?.();
  if (!raw) return undefined;
  const packs = raw.packs?.filter((id): id is AuthorityPackId =>
    ALL_PACK_IDS.includes(id as AuthorityPackId),
  );
  return {
    packs: packs?.length ? packs : undefined,
    yearFilterEnabled: raw.yearFilterEnabled,
    yearStart: raw.yearStart,
    yearEnd: raw.yearEnd,
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
