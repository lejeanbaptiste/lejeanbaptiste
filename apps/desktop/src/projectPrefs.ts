import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

interface AppPrefs {
  lastProjectFile: string | null;
  encoderName?: string;
}

const PREFS_FILENAME = 'project-prefs.json';

const getPrefsPath = () => path.join(app.getPath('userData'), PREFS_FILENAME);

const readAppPrefs = async (): Promise<AppPrefs> => {
  try {
    const raw = await fs.readFile(getPrefsPath(), 'utf-8');
    const parsed = JSON.parse(raw) as AppPrefs & { lastRootPath?: string | null };

    if (typeof parsed.lastProjectFile === 'string') {
      return {
        lastProjectFile: parsed.lastProjectFile,
        encoderName: typeof parsed.encoderName === 'string' ? parsed.encoderName : '',
      };
    }

    if (typeof parsed.lastRootPath === 'string') {
      return {
        lastProjectFile: path.join(parsed.lastRootPath, 'jean-baptiste.project.json'),
        encoderName: typeof parsed.encoderName === 'string' ? parsed.encoderName : '',
      };
    }

    return { lastProjectFile: null, encoderName: '' };
  } catch {
    return { lastProjectFile: null, encoderName: '' };
  }
};

const writeAppPrefs = async (prefs: AppPrefs) => {
  await fs.writeFile(getPrefsPath(), JSON.stringify(prefs, null, 2), 'utf-8');
};

export const writeLastProjectFile = async (projectFilePath: string) => {
  const prefs = await readAppPrefs();
  prefs.lastProjectFile = projectFilePath;
  await writeAppPrefs(prefs);
};

export const getValidLastProjectFile = async (): Promise<string | null> => {
  const prefs = await readAppPrefs();
  if (!prefs.lastProjectFile) return null;

  try {
    const stat = await fs.stat(prefs.lastProjectFile);
    if (stat.isFile()) return prefs.lastProjectFile;
  } catch {
    // Project file was moved or deleted.
  }

  return null;
};

export const getEncoderName = async (): Promise<string> => {
  const prefs = await readAppPrefs();
  return prefs.encoderName?.trim() ?? '';
};

export const setEncoderName = async (encoderName: string) => {
  const prefs = await readAppPrefs();
  prefs.encoderName = encoderName.trim();
  await writeAppPrefs(prefs);
};
