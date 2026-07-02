import fs from 'fs/promises';
import path from 'path';
import { isTranslationFile } from './translationFileNaming';

export interface NamedPath {
  name: string;
  path: string;
}

export const isPathInside = (parent: string, child: string): boolean => {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};

export const listProjectXmlFiles = async (rootPath: string): Promise<NamedPath[]> => {
  const results: NamedPath[] = [];
  const schemaDir = path.join(rootPath, 'schema');

  const walk = async (dirPath: string) => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (path.normalize(fullPath) === path.normalize(schemaDir)) continue;
        await walk(fullPath);
        continue;
      }
      if (entry.name.toLowerCase().endsWith('.xml') && !isTranslationFile(fullPath)) {
        results.push({ name: entry.name, path: fullPath });
      }
    }
  };

  await walk(rootPath);
  return results.sort((a, b) => a.path.localeCompare(b.path));
};

export const findXmlFilesByName = async (
  rootPath: string,
  query: string,
): Promise<NamedPath[]> => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const results: NamedPath[] = [];

  const walk = async (dirPath: string) => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (
        entry.name.toLowerCase().endsWith('.xml') &&
        entry.name.toLowerCase().includes(normalizedQuery)
      ) {
        results.push({ name: entry.name, path: fullPath });
      }
    }
  };

  await walk(rootPath);
  return results.sort((a, b) => a.name.localeCompare(b.name));
};

export const renamePath = async (oldPath: string, newPath: string): Promise<void> => {
  if (path.normalize(oldPath) === path.normalize(newPath)) {
    throw new Error('Same path');
  }

  try {
    await fs.access(newPath);
    throw new Error('Target already exists');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      if (error instanceof Error && error.message === 'Target already exists') throw error;
      throw error;
    }
  }

  await fs.rename(oldPath, newPath);
};

export const movePath = async (sourcePath: string, destDir: string): Promise<string> => {
  const destPath = path.join(destDir, path.basename(sourcePath));

  if (path.normalize(sourcePath) === path.normalize(destPath)) {
    throw new Error('Same path');
  }

  const stat = await fs.stat(sourcePath);
  if (stat.isDirectory() && isPathInside(sourcePath, destDir)) {
    throw new Error('Cannot move folder into itself');
  }

  try {
    await fs.access(destPath);
    throw new Error('Target already exists');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      if (error instanceof Error && error.message === 'Target already exists') throw error;
      throw error;
    }
  }

  await fs.rename(sourcePath, destPath);
  return destPath;
};

export const createDirectory = async (
  parentDir: string,
  folderName: string,
): Promise<string> => {
  const trimmed = folderName.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error('Invalid folder name');
  }

  try {
    const parentStat = await fs.stat(parentDir);
    if (!parentStat.isDirectory()) {
      throw new Error('Parent is not a directory');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('Parent directory does not exist');
    }
    throw error;
  }

  const newPath = path.join(parentDir, trimmed);

  try {
    await fs.access(newPath);
    throw new Error('Target already exists');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      if (error instanceof Error && error.message === 'Target already exists') throw error;
      throw error;
    }
  }

  await fs.mkdir(newPath);
  return newPath;
};

export const deletePath = async (targetPath: string): Promise<void> => {
  const stat = await fs.stat(targetPath);
  if (stat.isDirectory()) {
    await fs.rm(targetPath, { recursive: true });
    return;
  }
  await fs.unlink(targetPath);
};
