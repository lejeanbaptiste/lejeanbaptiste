import type { Types } from '@cwrc/leafwriter';
import { toLocalFileUrl } from './localFileUrl';

export const PROJECT_FILE_NAME = 'jean-baptiste.project.json';

export interface ProjectSchemaConfig {
  rng: string;
  css?: string;
}

export interface ProjectFileConfig {
  version: 1;
  name: string;
  schema?: ProjectSchemaConfig;
}

export interface ProjectBundle {
  config: ProjectFileConfig;
  projectFilePath: string;
  rootPath: string;
}

export const joinProjectPath = (rootPath: string, relativePath: string) => {
  const separator = rootPath.includes('\\') ? '\\' : '/';
  return [rootPath, ...relativePath.split(/[/\\]/)].join(separator);
};

const toSchemaId = (schemaPath: string) => {
  const base =
    schemaPath
      .split(/[/\\]/)
      .pop()
      ?.replace(/\.(rng|rnc|xsd)$/i, '') ?? 'project';
  return `project-${base.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
};

/** Build LEAF-Writer schema entries from a project file (paths relative to project root). */
export const buildProjectSchemas = (
  rootPath: string,
  config: ProjectFileConfig,
): Types.Schema[] => {
  if (!config.schema?.rng) return [];

  const rngPath = joinProjectPath(rootPath, config.schema.rng);
  const cssPath = config.schema.css
    ? joinProjectPath(rootPath, config.schema.css)
    : null;

  const schemaName =
    config.schema.rng
      .split(/[/\\]/)
      .pop()
      ?.replace(/\.(rng|rnc|xsd)$/i, '') ?? config.name;

  const cssUrl = cssPath ? toLocalFileUrl(cssPath) : 'https://cwrc.ca/templates/css/tei.css';

  return [
    {
      id: toSchemaId(rngPath),
      name: schemaName.slice(0, 20),
      mapping: 'tei',
      rng: [toLocalFileUrl(rngPath)],
      css: [cssUrl],
      editable: true,
    },
  ];
};
