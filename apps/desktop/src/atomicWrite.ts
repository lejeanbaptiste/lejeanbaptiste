import fs from 'fs/promises';

/**
 * Write `contents` to `filePath` via a sibling `.tmp`, then replace the
 * destination. On Windows, `rename(tmp, existing)` fails if the target
 * already exists (POSIX replaces), which left behind `*.json.tmp` files and
 * broke opening synced projects. Move the live file aside first, then swap.
 */
export const writeFileAtomic = async (filePath: string, contents: string): Promise<void> => {
  const tempPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.bak`;
  await fs.writeFile(tempPath, contents, 'utf-8');
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
 * If `filePath` is missing but a sibling `.tmp` from a failed Windows rename
 * remains, promote the temp file so the app can recover without manual fixup.
 */
export const recoverFromFailedAtomicWrite = async (filePath: string): Promise<boolean> => {
  const tempPath = `${filePath}.tmp`;
  try {
    await fs.access(filePath);
    return false;
  } catch {
    // Destination missing — try promoting a leftover temp.
  }
  try {
    await fs.access(tempPath);
  } catch {
    return false;
  }
  await fs.rename(tempPath, filePath);
  return true;
};
