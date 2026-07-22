import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import {
  DEFAULT_METADATA_PATH,
  PROJECT_FILE_NAME,
  type AutoTaggingAuthoritySettings,
  type DisambiguationSettings,
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

export const resolveProjectPath = (rootPath: string, relativePath: string): string => {
  if (path.isAbsolute(relativePath)) throw new Error('Project paths must be relative.');
  const resolvedRoot = path.resolve(rootPath);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Project path escapes the project directory.');
  }
  return resolved;
};

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
  if (value.dateFilter === 'none' || value.dateFilter === 'limit' || value.dateFilter === 'exclude') {
    out.dateFilter = value.dateFilter;
  }
  if (typeof value.yearFilterEnabled === 'boolean') out.yearFilterEnabled = value.yearFilterEnabled;
  if (yearStart != null) out.yearStart = yearStart;
  if (yearEnd != null) out.yearEnd = yearEnd;
  if (typeof value.hideUndated === 'boolean') out.hideUndated = value.hideUndated;
  return Object.keys(out).length ? out : undefined;
};

const normalizeDisambiguationSettings = (
  raw: unknown,
): DisambiguationSettings | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as DisambiguationSettings;
  const out: DisambiguationSettings = {};
  if (typeof value.aiCuration === 'boolean') out.aiCuration = value.aiCuration;
  if (typeof value.disableCaching === 'boolean') out.disableCaching = value.disableCaching;
  if (value.dateFilter === 'none' || value.dateFilter === 'limit' || value.dateFilter === 'exclude') {
    out.dateFilter = value.dateFilter;
  }
  if (typeof value.yearStart === 'number') out.yearStart = value.yearStart;
  if (typeof value.yearEnd === 'number') out.yearEnd = value.yearEnd;
  return Object.keys(out).length ? out : undefined;
};

const normalizeConfig = (raw: Partial<ProjectFileConfig>, rootPath: string): ProjectFileConfig => ({
  version: 1,
  name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : path.basename(rootPath),
  projectId: typeof raw.projectId === 'string' && raw.projectId.trim() ? raw.projectId.trim() : undefined,
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
  disambiguation: normalizeDisambiguationSettings(raw.disambiguation),
});

const writeConfigFile = async (projectFilePath: string, config: ProjectFileConfig): Promise<void> => {
  const tempPath = `${projectFilePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(config, null, 2), 'utf-8');
  await fs.rename(tempPath, projectFilePath);
};

export const writeProjectConfig = async (
  projectFilePath: string,
  patch: Partial<ProjectFileConfig>,
): Promise<ProjectBundle> => {
  const rootPath = path.dirname(projectFilePath);
  const raw = JSON.parse(await fs.readFile(projectFilePath, 'utf-8')) as Partial<ProjectFileConfig>;
  const config = normalizeConfig({ ...raw, ...patch }, rootPath);
  await writeConfigFile(projectFilePath, config);
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

  let raw: string;
  try {
    raw = await fs.readFile(projectFilePath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const config: ProjectFileConfig = {
      version: 1,
      name: path.basename(rootPath),
      projectId: randomUUID(),
      schema: await detectSchema(rootPath),
      metadata: DEFAULT_METADATA_PATH,
    };
    await writeConfigFile(projectFilePath, config);
    return { rootPath, projectFilePath, config };
  }

  const parsed = JSON.parse(raw) as Partial<ProjectFileConfig>;
  const config = normalizeConfig(parsed, rootPath);
  let dirty = false;
  if (!config.projectId) {
    config.projectId = randomUUID();
    dirty = true;
  }
  if (!config.schema) {
    config.schema = await detectSchema(rootPath);
    dirty = true;
  }
  if (dirty) await writeConfigFile(projectFilePath, config);
  return { rootPath, projectFilePath, config };
};

export const loadProjectFile = async (projectFilePath: string): Promise<ProjectBundle | null> => {
  try {
    const stat = await fs.stat(projectFilePath);
    if (!stat.isFile()) return null;

    const rootPath = path.dirname(projectFilePath);
    const raw = await fs.readFile(projectFilePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ProjectFileConfig>;
    const config = normalizeConfig(parsed, rootPath);
    let dirty = false;

    if (!config.projectId) {
      config.projectId = randomUUID();
      dirty = true;
    }

    if (config.schema?.rng) {
      try {
        await fs.stat(resolveProjectPath(rootPath, config.schema.rng));
      } catch {
        config.schema = await detectSchema(rootPath);
        dirty = true;
      }
    } else {
      config.schema = await detectSchema(rootPath);
      dirty = true;
    }

    if (dirty) await writeConfigFile(projectFilePath, config);

    return { rootPath, projectFilePath, config };
  } catch {
    return null;
  }
};
