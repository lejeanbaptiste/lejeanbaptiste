export const collectXmlFiles = async (dirPath: string): Promise<string[]> => {
  if (!window.electronAPI) return [];

  const entries = await window.electronAPI.readDirectory(dirPath, { allFiles: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) {
      files.push(...(await collectXmlFiles(entry.path)));
      continue;
    }
    if (entry.name.toLowerCase().endsWith('.xml')) {
      files.push(entry.path);
    }
  }

  return files;
};
