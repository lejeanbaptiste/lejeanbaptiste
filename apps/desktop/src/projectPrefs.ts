import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

interface ProjectPrefs {
  lastProjectFile: string | null;
}

const PREFS_FILENAME = 'project-prefs.json';

const getPrefsPath = () => path.join(app.getPath('userData'), PREFS_FILENAME);

const readProjectPrefs = async (): Promise<ProjectPrefs> => {
  try {
    const raw = await fs.readFile(getPrefsPath(), 'utf-8');
    const parsed = JSON.parse(raw) as ProjectPrefs & { lastRootPath?: string | null };

    if (typeof parsed.lastProjectFile === 'string') {
      return { lastProjectFile: parsed.lastProjectFile };
    }

    // Migrate from older builds that only stored the folder path.
    if (typeof parsed.lastRootPath === 'string') {
      return { lastProjectFile: path.join(parsed.lastRootPath, 'jean-baptiste.project.json') };
    }

    return { lastProjectFile: null };
  } catch {
    return { lastProjectFile: null };
  }
};

export const writeLastProjectFile = async (projectFilePath: string) => {
  const prefs: ProjectPrefs = { lastProjectFile: projectFilePath };
  await fs.writeFile(getPrefsPath(), JSON.stringify(prefs, null, 2), 'utf-8');
};

export const getValidLastProjectFile = async (): Promise<string | null> => {
  const prefs = await readProjectPrefs();
  if (!prefs.lastProjectFile) return null;

  try {
    const stat = await fs.stat(prefs.lastProjectFile);
    if (stat.isFile()) return prefs.lastProjectFile;
  } catch {
    // Project file was moved or deleted.
  }

  return null;
};
