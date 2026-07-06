import fs from 'fs/promises';
import path from 'path';

import {
  DEFAULT_METADATA_PATH,
  PROJECT_FILE_NAME,
  type AutoTaggingAuthoritySettings,
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

const normalizeAutoTaggingAuthority = (
  raw: unknown,
): AutoTaggingAuthoritySettings | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as AutoTaggingAuthoritySettings;
  const packs = Array.isArray(value.packs)
    ? value.packs.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    : undefined;
  const yearStart = typeof value.yearStart === 'number' ? value.yearStart : undefined;
  const yearEnd = typeof value.yearEnd === 'number' ? value.yearEnd : undefined;
  const out: AutoTaggingAuthoritySettings = {};
  if (packs?.length) out.packs = packs;
  if (typeof value.yearFilterEnabled === 'boolean') out.yearFilterEnabled = value.yearFilterEnabled;
  if (yearStart != null) out.yearStart = yearStart;
  if (yearEnd != null) out.yearEnd = yearEnd;
  if (typeof value.hideUndated === 'boolean') out.hideUndated = value.hideUndated;
  return Object.keys(out).length ? out : undefined;
};

const normalizeConfig = (raw: Partial<ProjectFileConfig>, rootPath: string): ProjectFileConfig => ({
  version: 1,
  name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : path.basename(rootPath),
  schema:
    raw.schema && typeof raw.schema.rng === 'string' && raw.schema.rng.trim()
      ? { ...raw.schema, rng: raw.schema.rng.trim() }
      : undefined,
  metadata:
    typeof raw.metadata === 'string' && raw.metadata.trim()
      ? raw.metadata.trim()
      : DEFAULT_METADATA_PATH,
  entityStore: (raw.entityStore === 'project' || raw.entityStore === 'central') ? raw.entityStore : undefined,
  entityDatabaseId:
    typeof raw.entityDatabaseId === 'string' && raw.entityDatabaseId.trim()
      ? raw.entityDatabaseId.trim()
      : undefined,
  autoTaggingAuthority: normalizeAutoTaggingAuthority(raw.autoTaggingAuthority),
});

export const writeProjectConfig = async (
  projectFilePath: string,
  patch: Partial<ProjectFileConfig>,
): Promise<ProjectBundle> => {
  const rootPath = path.dirname(projectFilePath);
  const raw = JSON.parse(await fs.readFile(projectFilePath, 'utf-8')) as Partial<ProjectFileConfig>;
  const config = normalizeConfig({ ...raw, ...patch }, rootPath);
  await fs.writeFile(projectFilePath, JSON.stringify(config, null, 2), 'utf-8');
  return { rootPath, projectFilePath, config };
};

const detectSchema = async (rootPath: string): Promise<ProjectSchemaConfig | undefined> => {
  const schemaDir = path.join(rootPath, 'schema');

  try {
    const entries = await fs.readdir(schemaDir, { withFileTypes: true });
    const rng = entries.find((entry) => !entry.isDirectory() && /\.rng$/i.test(entry.name));
    if (rng) {
      const css = entries.find(
        (entry) =>
          !entry.isDirectory() &&
          /\.css$/i.test(entry.name) &&
          entry.name.startsWith(rng.name.replace(/\.rng$/i, '')),
      );
      return {
        rng: `schema/${rng.name}`,
        css: css ? `schema/${css.name}` : undefined,
      };
    }

    const rnc = entries.find((entry) => !entry.isDirectory() && /\.rnc$/i.test(entry.name));
    if (rnc) {
      const rngName = rnc.name.replace(/\.rnc$/i, '.rng');
      const hasRng = entries.some((entry) => entry.name === rngName);
      return {
        rng: `schema/${hasRng ? rngName : rnc.name}`,
        css: entries.find((e) => e.name === 'cbeta.css') ? 'schema/cbeta.css' : undefined,
      };
    }
  } catch {
    // no schema directory
  }

  return undefined;
};

export const loadOrCreateProject = async (rootPath: string): Promise<ProjectBundle> => {
  const projectFilePath = path.join(rootPath, PROJECT_FILE_NAME);

  try {
    const raw = await fs.readFile(projectFilePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ProjectFileConfig>;
    const config = normalizeConfig(parsed, rootPath);

    if (!config.schema) {
      config.schema = await detectSchema(rootPath);
      await fs.writeFile(projectFilePath, JSON.stringify(config, null, 2), 'utf-8');
    }

    return { rootPath, projectFilePath, config };
  } catch {
    const config: ProjectFileConfig = {
      version: 1,
      name: path.basename(rootPath),
      schema: await detectSchema(rootPath),
      metadata: DEFAULT_METADATA_PATH,
    };
    await fs.writeFile(projectFilePath, JSON.stringify(config, null, 2), 'utf-8');
    return { rootPath, projectFilePath, config };
  }
};

export const loadProjectFile = async (projectFilePath: string): Promise<ProjectBundle | null> => {
  try {
    const stat = await fs.stat(projectFilePath);
    if (!stat.isFile()) return null;

    const rootPath = path.dirname(projectFilePath);
    const raw = await fs.readFile(projectFilePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ProjectFileConfig>;
    const config = normalizeConfig(parsed, rootPath);

    if (config.schema?.rng) {
      try {
        await fs.stat(path.join(rootPath, config.schema.rng));
      } catch {
        config.schema = await detectSchema(rootPath);
        await fs.writeFile(projectFilePath, JSON.stringify(config, null, 2), 'utf-8');
      }
    } else {
      config.schema = await detectSchema(rootPath);
      await fs.writeFile(projectFilePath, JSON.stringify(config, null, 2), 'utf-8');
    }

    return { rootPath, projectFilePath, config };
  } catch {
    return null;
  }
};
