import fs from 'fs/promises';
import path from 'path';

import { getCatalogEntry } from './schemaCatalog';
import {
  ensureSchemaDir,
  fetchText,
  parseInstalledVersion,
  sha256Hex,
  writeProjectConfig,
} from './schemaSetupHelpers';
import {
  loadProjectFile,
  resolveProjectPath,
  type ProjectBundle,
  type ProjectFileConfig,
  type ProjectSchemaConfig,
} from './projectFile';
import {
  shouldMergeSanmiaoDates,
  writeSanmiaoMergedTeiSchema,
} from './sanmiaoSchemaMerge';

const TEI_NS = 'http://www.tei-c.org/ns/1.0';

const restoreFile = async (filePath: string, prior: Buffer | null): Promise<void> => {
  if (prior) {
    await fs.writeFile(filePath, prior);
  } else {
    await fs.unlink(filePath).catch(() => undefined);
  }
};

export { parseInstalledVersion } from './schemaSetupHelpers';

export const installCatalogSchema = async (
  projectFilePath: string,
  catalogId: string,
): Promise<ProjectBundle> => {
  const entry = getCatalogEntry(catalogId);
  if (!entry) {
    throw new Error(`Unknown catalog schema: ${catalogId}`);
  }

  const bundle = await loadProjectFile(projectFilePath);
  if (!bundle) throw new Error('Project file not found');

  const { rootPath } = bundle;
  const priorConfigRaw = await fs.readFile(projectFilePath, 'utf-8');
  const schemaDir = await ensureSchemaDir(rootPath);
  const writtenFiles: string[] = [];
  const priorFiles = new Map<string, Buffer | null>();

  try {
    const { text: rngContent, url: sourceUrl } = await fetchText(entry.rngUrls);
    const { text: cssContent, url: sourceCssUrl } = await fetchText(entry.cssUrls);

    const rngPath = path.join(schemaDir, entry.localRngName);
    const cssPath = path.join(schemaDir, entry.localCssName);
    for (const filePath of [rngPath, cssPath]) {
      priorFiles.set(filePath, await fs.readFile(filePath).catch(() => null));
    }

    if (shouldMergeSanmiaoDates(entry.id, rngContent)) {
      await writeSanmiaoMergedTeiSchema(schemaDir, entry.localRngName, rngContent);
    } else {
      await fs.writeFile(rngPath, rngContent, 'utf-8');
    }
    await fs.writeFile(cssPath, cssContent, 'utf-8');
    writtenFiles.push(rngPath, cssPath);

    const schema: ProjectSchemaConfig = {
      rng: `schema/${entry.localRngName}`,
      css: `schema/${entry.localCssName}`,
      catalogId: entry.id,
      sourceUrl,
      sourceCssUrl,
      sourceHash: sha256Hex(rngContent),
      sourceCssHash: sha256Hex(cssContent),
      installedVersion: parseInstalledVersion(rngContent),
      installedAt: new Date().toISOString(),
    };

    const config: ProjectFileConfig = {
      ...bundle.config,
      schema,
      metadata: bundle.config.metadata ?? 'schema/project-metadata.json',
    };

    await writeProjectConfig(projectFilePath, config);

    const updated = await loadProjectFile(projectFilePath);
    if (!updated) throw new Error('Failed to reload project after schema install');
    return updated;
  } catch (error) {
    await fs.writeFile(projectFilePath, priorConfigRaw, 'utf-8');
    for (const filePath of writtenFiles) await restoreFile(filePath, priorFiles.get(filePath) ?? null);
    throw error;
  }
};

export const installLocalSchema = async (
  projectFilePath: string,
  rngPath: string,
  cssPath?: string | null,
): Promise<ProjectBundle> => {
  const bundle = await loadProjectFile(projectFilePath);
  if (!bundle) throw new Error('Project file not found');

  const priorConfigRaw = await fs.readFile(projectFilePath, 'utf-8');
  const schemaDir = await ensureSchemaDir(bundle.rootPath);
  const writtenFiles: string[] = [];
  const priorFiles = new Map<string, Buffer | null>();

  try {
    const rngName = path.basename(rngPath);
    const destRng = path.join(schemaDir, rngName);
    priorFiles.set(destRng, await fs.readFile(destRng).catch(() => null));
    await fs.copyFile(rngPath, destRng);
    writtenFiles.push(destRng);

    let relativeCss: string | undefined;
    if (cssPath) {
      const cssName = path.basename(cssPath);
      const destCss = path.join(schemaDir, cssName);
      priorFiles.set(destCss, await fs.readFile(destCss).catch(() => null));
      await fs.copyFile(cssPath, destCss);
      writtenFiles.push(destCss);
      relativeCss = `schema/${cssName}`;
    }

    const rngContent = await fs.readFile(destRng, 'utf-8');

    if (shouldMergeSanmiaoDates(undefined, rngContent)) {
      await writeSanmiaoMergedTeiSchema(schemaDir, rngName, rngContent);
    }

    const schema: ProjectSchemaConfig = {
      rng: `schema/${rngName}`,
      css: relativeCss,
      installedVersion: parseInstalledVersion(rngContent),
      installedAt: new Date().toISOString(),
    };

    const config: ProjectFileConfig = {
      ...bundle.config,
      schema,
      metadata: bundle.config.metadata ?? 'schema/project-metadata.json',
    };

    await writeProjectConfig(projectFilePath, config);

    const updated = await loadProjectFile(projectFilePath);
    if (!updated) throw new Error('Failed to reload project after local schema install');
    return updated;
  } catch (error) {
    await fs.writeFile(projectFilePath, priorConfigRaw, 'utf-8');
    for (const filePath of writtenFiles) await restoreFile(filePath, priorFiles.get(filePath) ?? null);
    throw error;
  }
};

export const projectHasSchema = async (bundle: ProjectBundle): Promise<boolean> => {
  if (!bundle.config.schema?.rng) return false;
  try {
    await fs.stat(resolveProjectPath(bundle.rootPath, bundle.config.schema.rng));
    return true;
  } catch {
    return false;
  }
};

export const metadataFileExists = async (bundle: ProjectBundle): Promise<boolean> => {
  const relative = bundle.config.metadata ?? 'schema/project-metadata.json';
  try {
    const stat = await fs.stat(resolveProjectPath(bundle.rootPath, relative));
    return stat.isFile();
  } catch {
    return false;
  }
};

/** Exported for tests — TEI namespace constant used by metadata apply in renderer. */
export { TEI_NS };
