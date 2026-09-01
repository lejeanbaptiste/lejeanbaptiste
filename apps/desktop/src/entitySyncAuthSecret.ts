/**
 * Encrypted storage for a static sync bearer token (auth mode "bearer").
 *
 * The GitHub token (mode "github") lives in `leaderboard-auth.json` and the
 * OIDC flow (mode "oidc") will cache its own; only the pasted static token
 * needs a home. Mirrors `entityDbBackupConfig.ts` — Electron `safeStorage`,
 * OS keychain-backed, in its own file under userData.
 */
import { app, safeStorage } from 'electron';
import fs from 'fs/promises';
import path from 'path';

const FILENAME = 'entity-sync-bearer.enc';
const getPath = () => path.join(app.getPath('userData'), FILENAME);

export const isSyncSecretStorageAvailable = (): boolean => {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
};

export const readSyncBearerToken = async (): Promise<string | null> => {
  let ciphertext: Buffer;
  try {
    ciphertext = await fs.readFile(getPath());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    return null;
  }
  if (!isSyncSecretStorageAvailable()) return null;
  try {
    return safeStorage.decryptString(ciphertext) || null;
  } catch {
    return null;
  }
};

export const hasSyncBearerToken = async (): Promise<boolean> =>
  (await readSyncBearerToken()) !== null;

/** `null`/`''` clears the stored token; any other string replaces it. */
export const writeSyncBearerToken = async (token: string | null): Promise<void> => {
  const filePath = getPath();
  if (!token) {
    await fs.rm(filePath, { force: true });
    return;
  }
  if (!isSyncSecretStorageAvailable()) {
    throw new Error(
      'Cannot store the sync token: this OS session has no keychain/keyring for encrypted storage.',
    );
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(`${filePath}.tmp`, safeStorage.encryptString(token));
  await fs.rename(`${filePath}.tmp`, filePath);
};
