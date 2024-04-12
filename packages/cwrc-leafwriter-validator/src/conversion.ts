import { convertRNGToPattern, makeResourceLoader, writeTreeToJSON } from '@cwrc/salve-leafwriter';
import { db } from './db';
import { log } from './log';
import type { CachedSchema, InitializeParameters } from './types';

const HASH_ALGORITHM = 'SHA-256';

export const processSchema = async ({ id, url, shouldCache = true }: InitializeParameters) => {
  //* Convert Schema
  const resourceLoader = makeResourceLoader();
  const convertedSchema = await convertRNGToPattern(new URL(url), {
    createManifest: shouldCache,
    manifestHashAlgorithm: HASH_ALGORITHM,
    resourceLoader,
  });

  const { manifest, pattern, simplified, warnings } = convertedSchema;

  //* Cache Schema
  if (manifest) {
    const gramarJson = writeTreeToJSON(simplified, 3);

    const cachedSchema: CachedSchema = {
      createdAt: new Date(),
      gramarJson,
      hash: manifest[0].hash,
      id,
      maxAge: 2592000000, // 30 days
      // simplified,
      url,
      warnings,
    };

    const cachedSchemaId = await db.cachedSchemas.put(cachedSchema);
    cachedSchemaId ? log.info('Schema cached: ', cachedSchemaId) : log.info('Schema cache failed');
  }

  return pattern;
};

export const verifyHash = async (url: string, cachedSchema: CachedSchema) => {
  //* Manifest stored from a different URL
  if (cachedSchema.url !== url) return false;

  //* Manifest stored with a different algorithm
  if (!cachedSchema.hash.startsWith(HASH_ALGORITHM)) return false;

  //* Manifest is expired
  if (cachedSchema.maxAge && Date.now() - cachedSchema.createdAt.getTime() > cachedSchema.maxAge) {
    return false;
  }

  //* Get resource
  const resource = await makeResourceLoader().load(new URL(url));
  const resourceText = await resource.getText();

  //* Hash content and transform
  const hashBuffer = await crypto.subtle.digest(
    HASH_ALGORITHM,
    new TextEncoder().encode(resourceText),
  );

  //* Convert buffer to byte array and then to hex string.
  // This will allows us to compare the downloaded content with the manifest we stored previously
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  //* Compare
  // Salve includes the algoritthm's name to the hash followerd by a "-" (dash).
  // We must extract it from the hash before the comparison.
  const manifestHash = cachedSchema.hash.slice(HASH_ALGORITHM.length + 1);
  const isSame = hashHex === manifestHash;

  return isSame;
};
