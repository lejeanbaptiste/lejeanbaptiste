import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { buildArchiveDestName } from '../../commons/src/desktop/schemaUpdateLogic';

import type { ProjectFileConfig } from './projectFile';

export const sha256Hex = (content: string): string =>
  crypto.createHash('sha256').update(content, 'utf8').digest('hex');

export const parseInstalledVersion = (rngContent: string): string | undefined => {
  const match = rngContent.match(/TEI Edition:\s*P5 Version\s+([\d.]+)/i);
  return match?.[1]?.replace(/\.$/, '');
};

export const fetchText = async (urls: string[]): Promise<{ text: string; url: string }> => {
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

export const writeProjectConfig = async (projectFilePath: string, config: ProjectFileConfig) => {
  await fs.writeFile(projectFilePath, JSON.stringify(config, null, 2), 'utf-8');
};

export const ensureSchemaDir = async (rootPath: string) => {
  const schemaDir = path.join(rootPath, 'schema');
  await fs.mkdir(schemaDir, { recursive: true });
  return schemaDir;
};

export const archiveSchemaFile = async (
  schemaDir: string,
  filePath: string,
  versionLabel?: string,
): Promise<string> => {
  const archiveDir = path.join(schemaDir, '_archive');
  await fs.mkdir(archiveDir, { recursive: true });
  const basename = path.basename(filePath);
  let destName = buildArchiveDestName(basename, versionLabel);
  let destPath = path.join(archiveDir, destName);
  let suffix = 1;
  while (true) {
    try {
      await fs.access(destPath);
      destName = buildArchiveDestName(basename, `${versionLabel ?? 'backup'}-${suffix}`);
      destPath = path.join(archiveDir, destName);
      suffix += 1;
    } catch {
      break;
    }
  }
  await fs.copyFile(filePath, destPath);
  return destPath;
};

export const archiveSchemaFiles = async (
  schemaDir: string,
  rngPath: string,
  cssPath?: string,
  versionLabel?: string,
): Promise<string[]> => {
  const archived: string[] = [];
  archived.push(await archiveSchemaFile(schemaDir, rngPath, versionLabel));
  if (cssPath) {
    try {
      await fs.stat(cssPath);
      archived.push(await archiveSchemaFile(schemaDir, cssPath, versionLabel));
    } catch {
      // CSS optional
    }
  }
  return archived;
};
