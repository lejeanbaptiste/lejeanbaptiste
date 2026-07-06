/**
 * Shared types for CHGIS local install (download → compile on user machine).
 */

export const CHGIS_MANIFEST_FILENAME = 'chgis.manifest.json';
export const CHGIS_RAW_SUBDIR = 'chgis/raw';

export const CHGIS_ATTRIBUTION =
  'CHGIS, Version 6. (c) Fairbank Center for Chinese Studies of Harvard University and the Center for Historical Geographical Studies at Fudan University, 2016.';

export const CHGIS_LICENSE_NOTICE =
  'CHGIS data is free for academic research. Commercial use, resale, and redistribution are not permitted. You must download from Harvard Dataverse and compile locally.';

export type ChgisInstallPhase = 'extracting' | 'compiling' | 'idle';

export interface ChgisInstallProgress {
  phase: ChgisInstallPhase;
  message: string;
}

export interface ChgisStatus {
  installed: boolean;
  entityDbFolder: string | null;
  entityDbReady: boolean;
  layers?: string[];
  placeCount?: number;
  crosswalkCount?: number;
  installedAt?: string;
  sourceArchive?: string;
  diskBytes?: number;
  lastError?: string;
  busy: boolean;
}

export interface ChgisInstallResult {
  ok: boolean;
  error?: string;
  placeCount?: number;
}
