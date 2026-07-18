import { createHmac, timingSafeEqual } from 'crypto';
import { app } from 'electron';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { getEntityDbFolder } from './projectPrefs';

/**
 * Achievements are global (cross-project) state, so they live next to the
 * central entity database when one is configured, else in userData. Reads
 * fall back to the userData copy so setting an entity database folder later
 * does not reset anyone's medals.
 */

const ACHIEVEMENTS_FILENAME = 'achievements.json';
const HMAC_SUFFIX = '.hmac';

const getUserDataPath = () => path.join(app.getPath('userData'), ACHIEVEMENTS_FILENAME);

const getPrimaryPath = async (): Promise<string> => {
  const entityDbFolder = await getEntityDbFolder();
  if (entityDbFolder && existsSync(entityDbFolder)) {
    return path.join(entityDbFolder, ACHIEVEMENTS_FILENAME);
  }
  return getUserDataPath();
};

/**
 * Detects hand-edited achievements.json files (e.g. via a since-removed
 * debug button, or opening the file in a text editor) so they don't get
 * loaded as-is. Ships embedded in the app like every other secret in this
 * codebase, so it isn't proof against someone willing to read the source -
 * it raises the bar past "edit the JSON", nothing stronger. XOR-obfuscated
 * (not just a bare hex literal) for consistency with the other embedded
 * keys in this app (see generated/gameAssetKey.ts).
 */
const OBFUSCATED_INTEGRITY_KEY_HEX =
  '5abc8c8735687359d4834d136bf4fa88efe96cf90f2ffba5a6991c939fe559f4';
const INTEGRITY_KEY_SALT = Buffer.from('leJeanBaptiste-achievements-integrity-v1');

const getIntegrityKey = (): Buffer => {
  const obfuscated = Buffer.from(OBFUSCATED_INTEGRITY_KEY_HEX, 'hex');
  return Buffer.from(obfuscated.map((byte, i) => byte ^ INTEGRITY_KEY_SALT[i % INTEGRITY_KEY_SALT.length]!));
};

const sign = (content: string): string =>
  createHmac('sha256', getIntegrityKey()).update(content, 'utf8').digest('hex');

const verify = (content: string, hmacHex: string): boolean => {
  try {
    const expected = Buffer.from(sign(content), 'hex');
    const actual = Buffer.from(hmacHex.trim(), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
};

/**
 * Reads achievements.json, verifying it against its .hmac sidecar when one
 * exists. A missing sidecar (every file written before this hardening
 * landed) is accepted once rather than rejected, so upgrading doesn't wipe
 * real progress - the next write signs it and closes the gap. A sidecar
 * that exists but doesn't match means the JSON was edited outside the app;
 * that candidate is skipped as if the file weren't there.
 */
export const readAchievementsFile = async (): Promise<string | null> => {
  const primary = await getPrimaryPath();
  const candidates = [
    { content: primary, signature: `${primary}${HMAC_SUFFIX}` },
    { content: `${primary}.bak`, signature: `${primary}${HMAC_SUFFIX}.bak` },
    { content: getUserDataPath(), signature: `${getUserDataPath()}${HMAC_SUFFIX}` },
    { content: `${getUserDataPath()}.bak`, signature: `${getUserDataPath()}${HMAC_SUFFIX}.bak` },
  ];
  for (const candidate of candidates) {
    try {
      const content = await fs.readFile(candidate.content, 'utf-8');
      const hmacHex = await fs.readFile(candidate.signature, 'utf-8').catch(() => null);
      if (hmacHex !== null && !verify(content, hmacHex)) continue;
      return content;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
};

/** Serialize writes so rapid saves cannot interleave partial JSON. */
let writeChain: Promise<void> = Promise.resolve();

export const writeAchievementsFile = async (content: string): Promise<void> => {
  writeChain = writeChain.then(async () => {
    const primary = await getPrimaryPath();
    const signature = `${primary}${HMAC_SUFFIX}`;
    const primaryBak = `${primary}.bak`;
    const signatureBak = `${signature}.bak`;
    const primaryTmp = `${primary}.tmp`;
    const signatureTmp = `${signature}.tmp`;
    await fs.writeFile(primaryTmp, content, 'utf-8');
    await fs.writeFile(signatureTmp, sign(content), 'utf-8');
    await fs.rename(primary, primaryBak).catch(() => undefined);
    await fs.rename(signature, signatureBak).catch(() => undefined);
    await fs.rename(primaryTmp, primary);
    await fs.rename(signatureTmp, signature);
    await fs.rm(primaryBak, { force: true });
    await fs.rm(signatureBak, { force: true });
  });
  await writeChain;
};
