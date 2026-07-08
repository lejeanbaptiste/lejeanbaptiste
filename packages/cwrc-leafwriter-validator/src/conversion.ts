import { convertRNGToPattern, makeResourceLoader, writeTreeToJSON } from '@cwrc/salve-leafwriter';
import { db } from './db';
import { log } from './log';
import type { CachedSchema, InitializeParameters } from './types';

const HASH_ALGORITHM = 'SHA-256';

/** Feed RelaxNG text directly to Salve — avoids fetch/blob issues in web workers. */
class StringResourceLoader {
  constructor(private readonly text: string) {}

  load(url: URL) {
    return Promise.resolve({
      url,
      getText: () => Promise.resolve(this.text),
    });
  }
}

const IN_MEMORY_SCHEMA_URL = 'rng:///schema.rng';

export const processSchema = async ({
  id,
  url,
  shouldCache = true,
  schemaText,
}: InitializeParameters) => {
  const resourceLoader = schemaText
    ? new StringResourceLoader(schemaText)
    : makeResourceLoader();
  // ljb:// and other custom schemes are not valid URL() inputs in all runtimes;
  // when compiling from schemaText the loader ignores the path anyway.
  const schemaPath = new URL(schemaText ? IN_MEMORY_SCHEMA_URL : url);

  try {
    const convertedSchema = await convertRNGToPattern(schemaPath, {
      createManifest: shouldCache,
      manifestHashAlgorithm: HASH_ALGORITHM,
      resourceLoader,
    });

    const { manifest, pattern, simplified, warnings } = convertedSchema;

    if (!pattern) {
      throw new Error('convertRNGToPattern returned no pattern');
    }

    const manifestEntry = manifest?.[0];
    if (shouldCache && manifestEntry?.hash) {
      const gramarJson = writeTreeToJSON(simplified, 3);

      const cachedSchema: CachedSchema = {
        createdAt: new Date(),
        gramarJson,
        hash: manifestEntry.hash,
        id,
        maxAge: 2592000000, // 30 days
        url,
        warnings,
      };

      const cachedSchemaId = await db.cachedSchemas.put(cachedSchema);
      log.info(cachedSchemaId ? `Schema cached: ${cachedSchemaId}` : 'Schema cache failed');
    }

    return pattern;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn(`Schema conversion failed for ${id}: ${message}`);
    throw error instanceof Error ? error : new Error(message);
  }
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
