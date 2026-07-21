import { constants } from 'fs';
import fs from 'fs/promises';
import path from 'path';

const BACKUP_DIR_NAME = '.ljb-time-machine';
const SNAPSHOTS_DIR_NAME = 'snapshots';
const RESTORE_STAGING_DIR_NAME = 'restore-staging';
const FILES_DIR_NAME = 'files';
const MANIFEST_FILE_NAME = 'manifest.json';

export interface TimeMachineSnapshotManifest {
  app: 'le-jean-baptiste';
  createdAt: string;
  fileCount: number;
  id: string;
  projectName: string;
  projectRootPath: string;
  sizeBytes: number;
  version: 1;
}

export interface TimeMachineSnapshotSummary extends TimeMachineSnapshotManifest {
  path: string;
}

interface CopyStats {
  copied: number;
  hardLinked: number;
  sizeBytes: number;
}

const isIgnorableEntry = (name: string) =>
  name === BACKUP_DIR_NAME || name === '.DS_Store' || name === 'Thumbs.db';

const getBackupRoot = (projectRootPath: string) => path.join(projectRootPath, BACKUP_DIR_NAME);
const getSnapshotsRoot = (projectRootPath: string) =>
  path.join(getBackupRoot(projectRootPath), SNAPSHOTS_DIR_NAME);

const makeSnapshotId = (date = new Date()) =>
  date.toISOString().replace(/\.\d{3}Z$/, '').replace(/:/g, '-');

const makeUniqueSnapshotPath = async (snapshotsRoot: string) => {
  const baseId = makeSnapshotId();
  let id = baseId;
  let snapshotPath = path.join(snapshotsRoot, id);
  let suffix = 2;

  while (await pathExists(snapshotPath)) {
    id = `${baseId}-${suffix}`;
    snapshotPath = path.join(snapshotsRoot, id);
    suffix += 1;
  }

  return { id, snapshotPath };
};

const pathExists = async (filePath: string) => {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const statMatches = async (source: string, candidate: string) => {
  try {
    const [sourceStat, candidateStat] = await Promise.all([fs.stat(source), fs.stat(candidate)]);
    return (
      sourceStat.isFile() &&
      candidateStat.isFile() &&
      sourceStat.size === candidateStat.size &&
      Math.trunc(sourceStat.mtimeMs) === Math.trunc(candidateStat.mtimeMs)
    );
  } catch {
    return false;
  }
};

const copyFileWithCloneFallback = async (source: string, destination: string) => {
  try {
    await fs.copyFile(source, destination, constants.COPYFILE_FICLONE);
  } catch {
    await fs.copyFile(source, destination);
  }
};

const copyTree = async (
  sourceRoot: string,
  destinationRoot: string,
  previousFilesRoot: string | null,
): Promise<{ fileCount: number; stats: CopyStats }> => {
  const stats: CopyStats = { copied: 0, hardLinked: 0, sizeBytes: 0 };
  let fileCount = 0;

  const walk = async (sourceDir: string, destinationDir: string) => {
    await fs.mkdir(destinationDir, { recursive: true });
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      if (isIgnorableEntry(entry.name)) continue;

      const sourcePath = path.join(sourceDir, entry.name);
      const destinationPath = path.join(destinationDir, entry.name);
      const relativePath = path.relative(sourceRoot, sourcePath);

      if (entry.isSymbolicLink()) {
        throw new Error(`Time-machine snapshots do not support symbolic links: ${relativePath}`);
      }

      if (entry.isDirectory()) {
        await walk(sourcePath, destinationPath);
        continue;
      }

      if (!entry.isFile() && !entry.isSymbolicLink()) continue;

      const sourceStat = await fs.stat(sourcePath);
      const previousPath = previousFilesRoot
        ? path.join(previousFilesRoot, relativePath)
        : null;

      if (previousPath && (await statMatches(sourcePath, previousPath))) {
        try {
          await fs.link(previousPath, destinationPath);
          stats.hardLinked += 1;
          stats.sizeBytes += sourceStat.size;
          fileCount += 1;
          continue;
        } catch {
          // Cross-device backup locations cannot hard-link; copy below.
        }
      }

      await copyFileWithCloneFallback(sourcePath, destinationPath);
      await fs.utimes(destinationPath, sourceStat.atime, sourceStat.mtime);
      stats.copied += 1;
      stats.sizeBytes += sourceStat.size;
      fileCount += 1;
    }
  };

  await walk(sourceRoot, destinationRoot);
  return { fileCount, stats };
};

export const listTimeMachineSnapshots = async (
  projectRootPath: string,
): Promise<TimeMachineSnapshotSummary[]> => {
  const snapshotsRoot = getSnapshotsRoot(projectRootPath);
  try {
    const entries = await fs.readdir(snapshotsRoot, { withFileTypes: true });
    const snapshots = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const snapshotPath = path.join(snapshotsRoot, entry.name);
          try {
            const raw = await fs.readFile(path.join(snapshotPath, MANIFEST_FILE_NAME), 'utf-8');
            const manifest = JSON.parse(raw) as TimeMachineSnapshotManifest;
            return { ...manifest, path: snapshotPath };
          } catch {
            return null;
          }
        }),
    );

    return snapshots
      .filter((snapshot): snapshot is TimeMachineSnapshotSummary => Boolean(snapshot))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
};

export const createTimeMachineSnapshot = async (
  projectRootPath: string,
  projectName: string,
): Promise<TimeMachineSnapshotSummary> => {
  const snapshotsRoot = getSnapshotsRoot(projectRootPath);
  await fs.mkdir(snapshotsRoot, { recursive: true });

  const previous = (await listTimeMachineSnapshots(projectRootPath))[0] ?? null;
  const { id, snapshotPath } = await makeUniqueSnapshotPath(snapshotsRoot);
  const filesPath = path.join(snapshotPath, FILES_DIR_NAME);

  await fs.mkdir(snapshotPath, { recursive: false });
  const { fileCount, stats } = await copyTree(
    projectRootPath,
    filesPath,
    previous ? path.join(previous.path, FILES_DIR_NAME) : null,
  );

  const manifest: TimeMachineSnapshotManifest = {
    app: 'le-jean-baptiste',
    createdAt: new Date().toISOString(),
    fileCount,
    id,
    projectName,
    projectRootPath,
    sizeBytes: stats.sizeBytes,
    version: 1,
  };

  await fs.writeFile(
    path.join(snapshotPath, MANIFEST_FILE_NAME),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );

  return { ...manifest, path: snapshotPath };
};

export const restoreTimeMachineSnapshotToDirectory = async (
  snapshotPath: string,
  destinationPath: string,
): Promise<void> => {
  const filesPath = path.join(snapshotPath, FILES_DIR_NAME);
  if (!(await pathExists(filesPath))) {
    throw new Error('Snapshot files are missing.');
  }

  await fs.mkdir(destinationPath, { recursive: true });
  const existingEntries = await fs.readdir(destinationPath);
  if (existingEntries.length > 0) {
    throw new Error('Choose an empty folder for restore.');
  }

  await copyTree(filesPath, destinationPath, null);
};

const clearProjectForRestore = async (projectRootPath: string) => {
  const entries = await fs.readdir(projectRootPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === BACKUP_DIR_NAME) continue;
    await fs.rm(path.join(projectRootPath, entry.name), {
      force: true,
      recursive: true,
    });
  }
};

const moveProjectEntries = async (sourceRoot: string, destinationRoot: string) => {
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === BACKUP_DIR_NAME) continue;
    await fs.rename(path.join(sourceRoot, entry.name), path.join(destinationRoot, entry.name));
  }
};

export const restoreTimeMachineSnapshotToProject = async (
  projectRootPath: string,
  projectName: string,
  snapshotPath: string,
): Promise<{ beforeRestoreSnapshot: TimeMachineSnapshotSummary }> => {
  const filesPath = path.join(snapshotPath, FILES_DIR_NAME);
  if (!(await pathExists(filesPath))) {
    throw new Error('Snapshot files are missing.');
  }

  const beforeRestoreSnapshot = await createTimeMachineSnapshot(projectRootPath, projectName);
  const stagingRoot = path.join(
    getBackupRoot(projectRootPath),
    RESTORE_STAGING_DIR_NAME,
    beforeRestoreSnapshot.id,
  );

  try {
    await fs.mkdir(stagingRoot, { recursive: true });
    await copyTree(filesPath, stagingRoot, null);
    const rollbackRoot = path.join(
      getBackupRoot(projectRootPath),
      RESTORE_STAGING_DIR_NAME,
      `${beforeRestoreSnapshot.id}-rollback`,
    );
    await fs.mkdir(rollbackRoot, { recursive: true });
    try {
      await moveProjectEntries(projectRootPath, rollbackRoot);
      await copyTree(stagingRoot, projectRootPath, null);
      await fs.rm(rollbackRoot, { force: true, recursive: true });
    } catch (error) {
      await clearProjectForRestore(projectRootPath);
      await moveProjectEntries(rollbackRoot, projectRootPath);
      throw error;
    }
  } finally {
    await fs.rm(stagingRoot, { force: true, recursive: true });
  }

  return { beforeRestoreSnapshot };
};

export const getDefaultTimeMachineRestorePath = (projectRootPath: string, snapshotId: string) => {
  const parent = path.dirname(projectRootPath);
  const projectName = path.basename(projectRootPath);
  return path.join(parent, `${projectName} restored ${snapshotId}`);
};
