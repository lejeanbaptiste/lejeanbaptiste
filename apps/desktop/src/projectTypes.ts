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
