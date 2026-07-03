import { INFRASTRUCTURE_DIR } from '../infrastructurePaths';

export const collectXmlFiles = async (dirPath: string): Promise<string[]> => {
  if (!window.electronAPI) return [];

  const entries = await window.electronAPI.readDirectory(dirPath, { allFiles: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) {
      // Reserved project infrastructure (entity file, decision log) is never
      // a search target — keep find/replace out of /.leaf/.
      if (entry.name === INFRASTRUCTURE_DIR) continue;
      files.push(...(await collectXmlFiles(entry.path)));
      continue;
    }
    if (entry.name.toLowerCase().endsWith('.xml')) {
      files.push(entry.path);
    }
  }

  return files;
};
