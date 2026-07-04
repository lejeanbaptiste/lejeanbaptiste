import { INFRASTRUCTURE_DIR, isCorpusExcludedPath } from '../infrastructurePaths';

export const collectXmlFiles = async (
  dirPath: string,
  projectRoot: string = dirPath,
): Promise<string[]> => {
  if (!window.electronAPI) return [];

  const entries = await window.electronAPI.readDirectory(dirPath, { allFiles: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) {
      if (entry.name === INFRASTRUCTURE_DIR) continue;
      files.push(...(await collectXmlFiles(entry.path, projectRoot)));
      continue;
    }
    if (
      entry.name.toLowerCase().endsWith('.xml') &&
      !isCorpusExcludedPath(entry.path, projectRoot)
    ) {
      files.push(entry.path);
    }
  }

  return files;
};
