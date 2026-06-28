import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { getCatalogEntry } from './schemaCatalog';
import {
  loadProjectFile,
  type ProjectBundle,
  type ProjectFileConfig,
  type ProjectSchemaConfig,
} from './projectFile';

const TEI_NS = 'http://www.tei-c.org/ns/1.0';

const sha256Hex = (content: string): string =>
  crypto.createHash('sha256').update(content, 'utf8').digest('hex');

export const parseInstalledVersion = (rngContent: string): string | undefined => {
  const match = rngContent.match(/TEI Edition:\s*P5 Version\s+([\d.]+)/i);
  return match?.[1];
};

const fetchText = async (urls: string[]): Promise<{ text: string; url: string }> => {
  let lastError: Error | undefined;

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} for ${url}`);
        continue;
      }
      const text = await response.text();
      if (text.trim()) return { text, url };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error('Failed to download schema resource');
};

const writeProjectConfig = async (projectFilePath: string, config: ProjectFileConfig) => {
  await fs.writeFile(projectFilePath, JSON.stringify(config, null, 2), 'utf-8');
};

const ensureSchemaDir = async (rootPath: string) => {
  const schemaDir = path.join(rootPath, 'schema');
  await fs.mkdir(schemaDir, { recursive: true });
  return schemaDir;
};

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

  try {
    const { text: rngContent, url: sourceUrl } = await fetchText(entry.rngUrls);
    const { text: cssContent, url: sourceCssUrl } = await fetchText(entry.cssUrls);

    const rngPath = path.join(schemaDir, entry.localRngName);
    const cssPath = path.join(schemaDir, entry.localCssName);

    await fs.writeFile(rngPath, rngContent, 'utf-8');
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
    for (const filePath of writtenFiles) {
      try {
        await fs.unlink(filePath);
      } catch {
        // ignore cleanup errors
      }
    }
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

  try {
    const rngName = path.basename(rngPath);
    const destRng = path.join(schemaDir, rngName);
    await fs.copyFile(rngPath, destRng);
    writtenFiles.push(destRng);

    let relativeCss: string | undefined;
    if (cssPath) {
      const cssName = path.basename(cssPath);
      const destCss = path.join(schemaDir, cssName);
      await fs.copyFile(cssPath, destCss);
      writtenFiles.push(destCss);
      relativeCss = `schema/${cssName}`;
    }

    const rngContent = await fs.readFile(destRng, 'utf-8');
    const isTeiLike = /<TEI\b/i.test(rngContent) || rngName.toLowerCase().includes('tei');

    const schema: ProjectSchemaConfig = {
      rng: `schema/${rngName}`,
      css: relativeCss,
      installedVersion: parseInstalledVersion(rngContent),
      installedAt: new Date().toISOString(),
      ...(isTeiLike ? {} : {}),
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
    for (const filePath of writtenFiles) {
      try {
        await fs.unlink(filePath);
      } catch {
        // ignore
      }
    }
    throw error;
  }
};

export const projectHasSchema = async (bundle: ProjectBundle): Promise<boolean> => {
  if (!bundle.config.schema?.rng) return false;
  try {
    await fs.stat(path.join(bundle.rootPath, bundle.config.schema.rng));
    return true;
  } catch {
    return false;
  }
};

export const metadataFileExists = async (bundle: ProjectBundle): Promise<boolean> => {
  const relative = bundle.config.metadata ?? 'schema/project-metadata.json';
  try {
    const stat = await fs.stat(path.join(bundle.rootPath, relative));
    return stat.isFile();
  } catch {
    return false;
  }
};

/** Exported for tests — TEI namespace constant used by metadata apply in renderer. */
export { TEI_NS };
