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
  /** Central (default) or project-local entity database. */
  entityStore?: 'central' | 'project';
  /** UUID fingerprint of the linked entities.xml database file. */
  entityDatabaseId?: string;
  /** Saved authority tag-bomb pack/year settings for this project. */
  autoTaggingAuthority?: AutoTaggingAuthoritySettings;
  /** Disambiguation panel preferences for this project. */
  disambiguation?: DisambiguationSettings;
}

export interface DisambiguationSettings {
  aiCuration?: boolean;
  /** Date-range filter for the disambiguation panel's own candidate filter. */
  dateFilter?: 'none' | 'limit' | 'exclude';
  yearStart?: number;
  yearEnd?: number;
}

/** Persisted in jean-baptiste.project.json — mirrors cwrc-leafwriter authoritySettings. */
export interface AutoTaggingAuthoritySettings {
  packs?: string[];
  yearFilterEnabled?: boolean;
  yearStart?: number;
  yearEnd?: number;
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
