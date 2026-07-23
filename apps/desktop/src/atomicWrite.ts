import fs from 'fs/promises';

/**
 * Write `contents` to `filePath` via a sibling `.tmp`, then replace the
 * destination.
 *
 * On POSIX, `rename(tmp, dest)` replaces atomically — the live file is never
 * absent, so concurrent readers never see ENOENT mid-write.
 *
 * On Windows, some Node/Electron builds refuse to rename over an existing
 * file. There we move the live file to `.bak` first, then swap `.tmp` into
 * place. That creates a brief window where the destination is missing;
 * {@link recoverFromFailedAtomicWrite} restores from `.tmp` or `.bak` if a
 * crash lands in that window. Never leave callers with neither file nor
 * recovery sibling.
 */
export const writeFileAtomic = async (filePath: string, contents: string): Promise<void> => {
  const tempPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.bak`;
  await fs.writeFile(tempPath, contents, 'utf-8');

  if (process.platform !== 'win32') {
    await fs.rename(tempPath, filePath);
    await fs.rm(backupPath, { force: true }).catch(() => undefined);
    return;
  }

  await fs.rename(filePath, backupPath).catch(() => undefined);
  try {
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rename(backupPath, filePath).catch(() => undefined);
    throw error;
  }
  await fs.rm(backupPath, { force: true }).catch(() => undefined);
};

/**
 * If `filePath` is missing after a crashed atomic write, promote a leftover
 * `.tmp` (new contents) or `.bak` (previous live file) so prefs/config are
 * not silently wiped to defaults.
 */
export const recoverFromFailedAtomicWrite = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return false;
  } catch {
    // Destination missing — try promoting leftovers.
  }

  const tempPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.bak`;

  try {
    await fs.access(tempPath);
    await fs.rename(tempPath, filePath);
    await fs.rm(backupPath, { force: true }).catch(() => undefined);
    return true;
  } catch {
    // no usable .tmp
  }

  try {
    await fs.access(backupPath);
    await fs.rename(backupPath, filePath);
    return true;
  } catch {
    return false;
  }
};
