import type { Types } from '@cwrc/leafwriter';
import { toLocalFileUrl } from './localFileUrl';
import {
  type ProjectBundle,
  type ProjectFileConfig,
  type ProjectSchemaConfig,
} from './projectTypes';

export {
  DEFAULT_METADATA_PATH,
  PROJECT_FILE_NAME,
  type ProjectBundle,
  type ProjectFileConfig,
  type ProjectMetadataFile,
  type ProjectSchemaConfig,
} from './projectTypes';

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

  const mapping =
    config.schema.catalogId === 'teiLite' || schemaName.toLowerCase().includes('lite')
      ? 'teiLite'
      : config.schema.catalogId === 'orlando' || schemaName.toLowerCase().includes('orlando')
        ? 'orlando'
        : 'tei';

  const cssUrl = cssPath ? toLocalFileUrl(cssPath) : 'https://cwrc.ca/templates/css/tei.css';

  return [
    {
      id: toSchemaId(rngPath),
      name: schemaName.slice(0, 20),
      mapping,
      rng: [toLocalFileUrl(rngPath)],
      css: [cssUrl],
      editable: true,
    },
  ];
};

export const getMetadataRelativePath = (config: ProjectFileConfig): string =>
  config.metadata ?? 'schema/project-metadata.json';

export const getMetadataAbsolutePath = (bundle: ProjectBundle): string =>
  joinProjectPath(bundle.rootPath, getMetadataRelativePath(bundle.config));
