import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { app } from 'electron';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { getAchievementsFolder, getEntityDbFolder } from './projectPrefs';

/**
 * Achievements are global (cross-project) state. They live wherever the
 * player explicitly points achievementsFolder (e.g. a folder their own
 * cloud-sync tool watches), else next to the central entity database when
 * one is configured, else in userData. Reads fall back through each of
 * those in turn so changing folders later never looks like a wipe.
 */

const ACHIEVEMENTS_FILENAME = 'achievements.json';
const LEGACY_HMAC_SUFFIX = '.hmac';
const ENVELOPE_VERSION = 2;

const getUserDataPath = () => path.join(app.getPath('userData'), ACHIEVEMENTS_FILENAME);

const getPrimaryPath = async (): Promise<string> => {
  const achievementsFolder = await getAchievementsFolder();
  if (achievementsFolder && existsSync(achievementsFolder)) {
    return path.join(achievementsFolder, ACHIEVEMENTS_FILENAME);
  }
  const entityDbFolder = await getEntityDbFolder();
  if (entityDbFolder && existsSync(entityDbFolder)) {
    return path.join(entityDbFolder, ACHIEVEMENTS_FILENAME);
  }
  return getUserDataPath();
};

/**
 * Base secret for both the legacy HMAC scheme and the current encryption
 * key, derived per-purpose below. Ships embedded in the app like every
 * other secret in this codebase, so it isn't proof against someone willing
 * to read the source - it raises the bar past "edit the JSON in a text
 * editor", nothing stronger. XOR-obfuscated (not a bare hex literal) for
 * consistency with the other embedded keys in this app (see
 * generated/gameAssetKey.ts).
 */
const OBFUSCATED_BASE_SECRET_HEX =
  '5abc8c8735687359d4834d136bf4fa88efe96cf90f2ffba5a6991c939fe559f4';
const BASE_SECRET_SALT = Buffer.from('leJeanBaptiste-achievements-integrity-v1');

const getBaseSecret = (): Buffer => {
  const obfuscated = Buffer.from(OBFUSCATED_BASE_SECRET_HEX, 'hex');
  return Buffer.from(
    obfuscated.map((byte, i) => byte ^ BASE_SECRET_SALT[i % BASE_SECRET_SALT.length]!),
  );
};

/** Purpose-separated key derivation from the one embedded base secret. */
const deriveKey = (purpose: string): Buffer =>
  createHash('sha256').update(getBaseSecret()).update(purpose).digest();

const getEncryptionKey = (): Buffer => deriveKey('encryption-v1');
/** The pre-encryption format signed with the base secret directly (unsalted by purpose). */
const getLegacyIntegrityKey = (): Buffer => getBaseSecret();

const legacySign = (content: string): string =>
  createHmac('sha256', getLegacyIntegrityKey()).update(content, 'utf8').digest('hex');

const legacyVerify = (content: string, hmacHex: string): boolean => {
  try {
    const expected = Buffer.from(legacySign(content), 'hex');
    const actual = Buffer.from(hmacHex.trim(), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
};

interface EncryptedEnvelope {
  v: 2;
  iv: string;
  tag: string;
  data: string;
}

const encrypt = (plaintext: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const envelope: EncryptedEnvelope = {
    v: ENVELOPE_VERSION,
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: data.toString('hex'),
  };
  return JSON.stringify(envelope);
};

/** Returns null if `raw` isn't a v2 envelope, or if decryption/auth fails. */
const tryDecrypt = (raw: string): string | null => {
  let envelope: Partial<EncryptedEnvelope>;
  try {
    envelope = JSON.parse(raw) as Partial<EncryptedEnvelope>;
  } catch {
    return null;
  }
  if (
    envelope.v !== ENVELOPE_VERSION ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.tag !== 'string' ||
    typeof envelope.data !== 'string'
  ) {
    return null;
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(envelope.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.data, 'hex')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch {
    // Auth tag mismatch (tampered/corrupt) or malformed hex.
    return null;
  }
};

/**
 * Reads one achievements file at an exact path: tries the current encrypted
 * envelope first, then falls back to the legacy plaintext + .hmac sidecar
 * format (pre-encryption files, or files a tester hand-edited before this
 * hardening landed). A missing legacy sidecar is accepted once rather than
 * rejected so upgrading doesn't wipe real progress. A sidecar that exists
 * but doesn't match means the JSON was edited outside the app; that's
 * treated as if the file weren't there.
 */
const readOneCandidate = async (filePath: string): Promise<string | null> => {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }

  const decrypted = tryDecrypt(raw);
  if (decrypted !== null) return decrypted;

  const legacyHmac = await fs.readFile(`${filePath}${LEGACY_HMAC_SUFFIX}`, 'utf-8').catch(() => null);
  if (legacyHmac !== null && !legacyVerify(raw, legacyHmac)) return null;
  return raw;
};

/** Reads an arbitrary achievements file, e.g. one picked for import. Never throws. */
export const readAchievementsFileFrom = async (filePath: string): Promise<string | null> =>
  readOneCandidate(filePath);

/**
 * Checks whether a candidate achievements folder actually has a loadable
 * file in it, so the settings panel can warn immediately instead of the
 * folder silently falling back to the old storage location on next read.
 */
export const checkAchievementsFolder = async (
  folder: string,
): Promise<{ hasFile: boolean; readable: boolean }> => {
  const filePath = path.join(folder, ACHIEVEMENTS_FILENAME);
  if (!existsSync(filePath)) return { hasFile: false, readable: true };
  const content = await readOneCandidate(filePath);
  return { hasFile: true, readable: content !== null };
};

export const readAchievementsFile = async (): Promise<string | null> => {
  const primary = await getPrimaryPath();
  const candidates = [primary, `${primary}.bak`, getUserDataPath(), `${getUserDataPath()}.bak`];
  for (const candidate of candidates) {
    const content = await readOneCandidate(candidate);
    if (content !== null) return content;
  }
  return null;
};

/** Serialize writes so rapid saves cannot interleave partial files. */
let writeChain: Promise<void> = Promise.resolve();

export const writeAchievementsFile = async (content: string): Promise<void> => {
  writeChain = writeChain.then(async () => {
    const primary = await getPrimaryPath();
    const primaryBak = `${primary}.bak`;
    const primaryTmp = `${primary}.tmp`;
    await fs.writeFile(primaryTmp, encrypt(content), 'utf-8');
    await fs.rename(primary, primaryBak).catch(() => undefined);
    await fs.rename(primaryTmp, primary);
    await fs.rm(primaryBak, { force: true });
    // Legacy sidecar from the pre-encryption format; the envelope above is
    // now self-authenticating, so this file is dead weight once present.
    await fs.rm(`${primary}${LEGACY_HMAC_SUFFIX}`, { force: true }).catch(() => undefined);
  });
  await writeChain;
};
