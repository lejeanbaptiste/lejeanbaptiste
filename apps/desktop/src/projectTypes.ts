export const PROJECT_FILE_NAME = 'jean-baptiste.project.json';
export const DEFAULT_METADATA_PATH = 'schema/project-metadata.json';

export interface ProjectSchemaConfig {
  rng: string;
  css?: string;
  catalogId?: string;
  sourceUrl?: string;
  sourceCssUrl?: string;
  sourceHash?: string;
  sourceCssHash?: string;
  installedVersion?: string;
  installedAt?: string;
  lastCheckedAt?: string;
}

export interface ProjectFileConfig {
  version: 1;
  name: string;
  schema?: ProjectSchemaConfig;
  metadata?: string;
  /**
   * Stable identity for this project, independent of its filesystem path.
   * Generated once and persisted here (not derived from rootPath) so the
   * same project checked out at different absolute paths - e.g. Mac vs
   * Windows checkouts of the same repo - is recognized as one project by
   * the achievements engine instead of accumulating two separate,
   * double-counted entries.
   */
  projectId?: string;
  /** UUID fingerprint of the linked entities.xml database file. */
  entityDatabaseId?: string;
  /** When true, this project's PEDB is kept auto-synced with the CEDB (Promote on create, no manual Bridge). */
  syncToCentral?: boolean;
  /** Saved authority tag-bomb pack/year settings for this project. */
  autoTaggingAuthority?: AutoTaggingAuthoritySettings;
  /** Disambiguation panel preferences for this project. */
  disambiguation?: DisambiguationSettings;
}

export interface DisambiguationSettings {
  aiCuration?: boolean;
  disableCaching?: boolean;
  /** Date-range filter for the disambiguation panel's own candidate filter. */
  dateFilter?: 'none' | 'limit' | 'exclude';
  yearStart?: number;
  yearEnd?: number;
}

/** Persisted in jean-baptiste.project.json — mirrors cwrc-leafwriter authoritySettings. */
export interface AutoTaggingAuthoritySettings {
  packs?: string[];
  dateFilter?: 'none' | 'limit' | 'exclude';
  yearFilterEnabled?: boolean;
  yearStart?: number;
  yearEnd?: number;
  /** Name types barred from seeding corpus auto-tagging (default: courtesy names 字). */
  excludedNameTypes?: string[];
  hideUndated?: boolean;
}

export interface ProjectMetadataFile {
  version: 1;
  catalogId?: string;
  fields: Record<string, string>;
  custom: Array<{ path: string; label: string; value: string }>;
}

export interface ProjectBundle {
  config: ProjectFileConfig;
  projectFilePath: string;
  rootPath: string;
}
