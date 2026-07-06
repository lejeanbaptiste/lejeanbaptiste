export interface DynastyAuthorityEntry {
  dynId: number;
  label: string;
  startYear?: number | null;
  endYear?: number | null;
  calStream?: number | null;
  searchText: string;
}

export interface RulerAuthorityEntry {
  rulerId: number;
  dynId: number;
  label: string;
  dynLabel: string;
  startYear?: number | null;
  endYear?: number | null;
  searchText: string;
}

export interface EraAuthorityEntry {
  eraId: number;
  dynId: number;
  rulerId?: number | null;
  label: string;
  labelSimp?: string | null;
  dynLabel: string;
  rulerLabel: string;
  startYear?: number | null;
  endYear?: number | null;
  searchText: string;
}

export interface DateAuthorityIndex {
  dynasties: DynastyAuthorityEntry[];
  rulers: RulerAuthorityEntry[];
  eras: EraAuthorityEntry[];
}

export interface EastAsianDateValues {
  dynId: string;
  rulerId: string;
  eraId: string;
  year: string;
  month: string;
  day: string;
  /** Sexagenary year index (sex_year). */
  sexYear: string;
  /** Sexagenary day index (gz), 1–60; accepts 甲子-style names. */
  gz: string;
  /** New-moon sexagenary day index (nmd_gz). */
  nmdGz: string;
}

export const EMPTY_EAST_ASIAN_DATE_VALUES: EastAsianDateValues = {
  dynId: '',
  rulerId: '',
  eraId: '',
  year: '',
  month: '',
  day: '',
  sexYear: '',
  gz: '',
  nmdGz: '',
};

export const EAST_ASIAN_DATE_ATTR_NAMES = [
  'dyn_id',
  'ruler_id',
  'era_id',
  'year',
  'month',
  'day',
  'sex_year',
  'gz',
  'nmd_gz',
] as const;
