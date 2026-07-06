import fs from 'fs/promises';
import path from 'path';

import { getCatalogEntry } from './schemaCatalog';
import {
  archiveSchemaFiles,
  ensureSchemaDir,
  fetchText,
  parseInstalledVersion,
  sha256Hex,
  writeProjectConfig,
} from './schemaSetupHelpers';
import { loadProjectFile, type ProjectBundle, type ProjectFileConfig, type ProjectSchemaConfig } from './projectFile';
import {
  shouldMergeSanmiaoDates,
  writeSanmiaoMergedTeiSchema,
} from './sanmiaoSchemaMerge';
import type { ProjectMetadataFile } from './projectTypes';
import {
  isSchemaCheckThrottled,
  schemaHashesDiffer,
  shouldBypassSchemaCheckThrottle,
  validateMetadataPathsAfterUpgrade,
} from '../../commons/src/desktop/schemaUpdateLogic';
import type { SchemaUpdateApplyResult, SchemaUpdateCheckResult } from '../../commons/src/desktop/schemaUpdateTypes';

const TEI_NS = 'http://www.tei-c.org/ns/1.0';

const touchLastCheckedAt = async (projectFilePath: string, bundle: ProjectBundle) => {
  if (!bundle.config.schema) return;
  const config: ProjectFileConfig = {
    ...bundle.config,
    schema: {
      ...bundle.config.schema,
      lastCheckedAt: new Date().toISOString(),
    },
  };
  await writeProjectConfig(projectFilePath, config);
};

const readMetadataFile = async (
  bundle: ProjectBundle,
): Promise<ProjectMetadataFile | null> => {
  const relative = bundle.config.metadata ?? 'schema/project-metadata.json';
  try {
    const raw = await fs.readFile(path.join(bundle.rootPath, relative), 'utf-8');
    return JSON.parse(raw) as ProjectMetadataFile;
  } catch {
    return null;
  }
};

export const checkCatalogSchemaUpdate = async (
  projectFilePath: string,
  options?: { force?: boolean },
): Promise<SchemaUpdateCheckResult> => {
  const bundle = await loadProjectFile(projectFilePath);
  if (!bundle) {
    return { status: 'skipped', reason: 'Project file not found' };
  }

  const schema = bundle.config.schema;
  if (!schema?.catalogId || !schema.sourceHash) {
    return { status: 'skipped', reason: 'Not a catalog-installed schema' };
  }

  let onDiskRngHash: string | undefined;
  let onDiskCssHash: string | undefined;
  try {
    const rngContent = await fs.readFile(path.join(bundle.rootPath, schema.rng), 'utf-8');
    onDiskRngHash = sha256Hex(rngContent);
    if (schema.css) {
      try {
        const cssContent = await fs.readFile(path.join(bundle.rootPath, schema.css), 'utf-8');
        onDiskCssHash = sha256Hex(cssContent);
      } catch {
        onDiskCssHash = undefined;
      }
    }
  } catch {
    onDiskRngHash = undefined;
  }

  const projectFileMtimeMs = (await fs.stat(projectFilePath)).mtimeMs;
  const bypassThrottle = shouldBypassSchemaCheckThrottle(
    schema.lastCheckedAt,
    projectFileMtimeMs,
    schema.sourceHash,
    onDiskRngHash,
    schema.sourceCssHash,
    onDiskCssHash,
  );

  if (!options?.force && isSchemaCheckThrottled(schema.lastCheckedAt) && !bypassThrottle) {
    return { status: 'skipped', reason: 'Checked recently' };
  }

  const entry = getCatalogEntry(schema.catalogId);
  if (!entry) {
    await touchLastCheckedAt(projectFilePath, bundle);
    return { status: 'skipped', reason: 'Unknown catalog entry' };
  }

  try {
    const { text: remoteRng } = await fetchText(entry.rngUrls);
    const remoteRngHash = sha256Hex(remoteRng);
    const { text: remoteCss } = await fetchText(entry.cssUrls);
    const remoteCssHash = sha256Hex(remoteCss);
    const { cssChanged, rngChanged } = schemaHashesDiffer(
      { sourceHash: schema.sourceHash, sourceCssHash: schema.sourceCssHash },
      { cssHash: remoteCssHash, rngHash: remoteRngHash },
    );

    const remoteVersion = parseInstalledVersion(remoteRng);
    const localVersion = schema.installedVersion;

    await touchLastCheckedAt(projectFilePath, bundle);

    if (!rngChanged && !cssChanged) {
      return {
        status: 'current',
        catalogLabel: entry.name,
        localVersion,
        remoteVersion,
      };
    }

    return {
      status: 'updateAvailable',
      catalogId: entry.id,
      catalogLabel: entry.name,
      cssChanged,
      localVersion,
      remoteVersion,
      rngChanged,
    };
  } catch {
    await touchLastCheckedAt(projectFilePath, bundle);
    return { status: 'skipped', reason: 'Could not reach schema source' };
  }
};

export const applyCatalogSchemaUpdate = async (
  projectFilePath: string,
): Promise<SchemaUpdateApplyResult> => {
  const bundle = await loadProjectFile(projectFilePath);
  if (!bundle) {
    return { bundle: null, metadataWarnings: [] };
  }

  const schema = bundle.config.schema;
  if (!schema?.catalogId) {
    throw new Error('Project has no catalog schema to update');
  }

  const entry = getCatalogEntry(schema.catalogId);
  if (!entry) {
    throw new Error(`Unknown catalog schema: ${schema.catalogId}`);
  }

  const priorConfigRaw = await fs.readFile(projectFilePath, 'utf-8');
  const schemaDir = await ensureSchemaDir(bundle.rootPath);
  const rngPath = path.join(bundle.rootPath, schema.rng);
  const cssRelative = schema.css;
  const cssPath = cssRelative ? path.join(bundle.rootPath, cssRelative) : undefined;

  let priorRngContent: string | undefined;
  let priorCssContent: string | undefined;

  try {
    priorRngContent = await fs.readFile(rngPath, 'utf-8');
    if (cssPath) {
      try {
        priorCssContent = await fs.readFile(cssPath, 'utf-8');
      } catch {
        priorCssContent = undefined;
      }
    }
  } catch {
    throw new Error('Installed schema files are missing from the project');
  }

  const versionLabel = schema.installedVersion ?? undefined;

  try {
    await archiveSchemaFiles(schemaDir, rngPath, cssPath, versionLabel);

    const { text: rngContent, url: sourceUrl } = await fetchText(entry.rngUrls);
    const { text: cssContent, url: sourceCssUrl } = await fetchText(entry.cssUrls);

    if (shouldMergeSanmiaoDates(entry.id, rngContent)) {
      await writeSanmiaoMergedTeiSchema(schemaDir, entry.localRngName, rngContent);
    } else {
      await fs.writeFile(rngPath, rngContent, 'utf-8');
    }

    let relativeCss = schema.css;
    if (cssPath) {
      await fs.writeFile(cssPath, cssContent, 'utf-8');
    } else {
      const destCssPath = path.join(schemaDir, entry.localCssName);
      await fs.writeFile(destCssPath, cssContent, 'utf-8');
      relativeCss = `schema/${entry.localCssName}`;
    }

    const updatedSchema: ProjectSchemaConfig = {
      ...schema,
      css: relativeCss,
      sourceUrl,
      sourceCssUrl,
      sourceHash: sha256Hex(rngContent),
      sourceCssHash: sha256Hex(cssContent),
      installedVersion: parseInstalledVersion(rngContent),
      installedAt: new Date().toISOString(),
    };

    const config: ProjectFileConfig = {
      ...bundle.config,
      schema: updatedSchema,
    };

    await writeProjectConfig(projectFilePath, config);

    const updatedBundle: ProjectBundle = {
      rootPath: bundle.rootPath,
      projectFilePath: bundle.projectFilePath,
      config,
    };

    const metadata = await readMetadataFile(updatedBundle);
    const metadataWarnings = metadata
      ? validateMetadataPathsAfterUpgrade(metadata, schema.catalogId)
      : [];

    return { bundle: updatedBundle, metadataWarnings };
  } catch (error) {
    await fs.writeFile(projectFilePath, priorConfigRaw, 'utf-8');
    if (priorRngContent) {
      await fs.writeFile(rngPath, priorRngContent, 'utf-8');
    }
    if (cssPath && priorCssContent) {
      await fs.writeFile(cssPath, priorCssContent, 'utf-8');
    }
    throw error;
  }
};

export { TEI_NS };
