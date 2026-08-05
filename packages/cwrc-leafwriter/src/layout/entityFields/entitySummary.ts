/** Shared with the Word add-in's display rules (wordprocessor/src/entityDisplay.ts). */

export type EntityKind = 'person' | 'place' | 'org' | 'work' | 'office';

export interface EntityDates {
  startYear: number | null;
  endYear: number | null;
  startPrecision: string | null;
  endPrecision: string | null;
}

export interface EntitySummary {
  id: string;
  kind: EntityKind;
  names: { lang: string | null; text: string }[];
  primaryName: string | null;
  romanizedName: string | null;
  description: string | null;
  dates: EntityDates | null;
  familyName: string | null;
  authorityIds: { type: string | null; value: string }[];
}

/** Loose shape returned by `entitySqliteGet` / panel summaries. */
export interface SqlitePanelLike {
  id: string;
  kind: string;
  description: string | null;
  familyName: string | null;
  startYear: number | null;
  endYear: number | null;
  workDate?: {
    startYear: number | null;
    endYear: number | null;
    startPrecision: string | null;
    endPrecision: string | null;
  } | null;
  names: Array<{
    text: string;
    language: string | null;
    nameType?: string | null;
    nameRole?: string | null;
    status?: string | null;
  }>;
  assertions?: Array<{
    element: string;
    status?: string | null;
    whenPrecision?: string | null;
  }>;
  authorities?: Array<{ type: string | null; value: string }>;
}

const datesFromPanel = (panel: SqlitePanelLike): EntityDates | null => {
  if (panel.kind === 'work' && panel.workDate) {
    const { startYear, endYear, startPrecision, endPrecision } = panel.workDate;
    if (startYear == null && endYear == null) return null;
    return { startYear, endYear, startPrecision, endPrecision };
  }
  const birth = panel.assertions?.find((a) => a.element === 'birth' && a.status === 'active');
  const death = panel.assertions?.find((a) => a.element === 'death' && a.status === 'active');
  if (birth || death || panel.startYear != null || panel.endYear != null) {
    return {
      startYear: panel.startYear,
      endYear: panel.endYear,
      startPrecision: birth?.whenPrecision ?? null,
      endPrecision: death?.whenPrecision ?? null,
    };
  }
  return null;
};

export const summaryFromSqlitePanel = (panel: SqlitePanelLike): EntitySummary => {
  const activeNames = panel.names.filter((name) => !name.status || name.status === 'active');
  const primary =
    activeNames.find((name) => name.nameType === 'primary' || name.nameRole === 'primary') ??
    activeNames[0];
  const romanized = activeNames.find((name) => (name.language ?? '').endsWith('-Latn'));
  return {
    id: panel.id,
    kind: panel.kind as EntityKind,
    names: activeNames.map((name) => ({ lang: name.language, text: name.text })),
    primaryName: primary?.text ?? null,
    romanizedName: romanized?.text ?? null,
    description: panel.description,
    dates: datesFromPanel(panel),
    familyName: panel.familyName,
    authorityIds: (panel.authorities ?? []).map((authority) => ({
      type: authority.type,
      value: authority.value,
    })),
  };
};
