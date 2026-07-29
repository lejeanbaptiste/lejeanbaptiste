/**
 * Pre-compiled authority pack discovery under `<entityDbFolder>/authority-packs/`.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

import {
  AUTHORITY_PACKS,
  authorityPackOrigin,
  type AuthorityPackId,
  type AuthorityPackStatus,
  packPath,
  packsRoot,
} from '../../commons/src/desktop/authorityPackTypes';

/** File-backed specs only — pedb/cedb/project/list packs are read live, never on disk. */
const filePacks = () => AUTHORITY_PACKS.filter((spec) => !spec.virtual && authorityPackOrigin(spec) === 'file');

export {
  AUTHORITY_PACKS_DIRNAME,
  AUTHORITY_PACKS,
  authorityPackOrigin,
  type AuthorityPackId,
  type AuthorityPackStatus,
  packPath,
  packsRoot,
} from '../../commons/src/desktop/authorityPackTypes';

export async function getAuthorityPackStatuses(
  baseFolder: string,
): Promise<AuthorityPackStatus[]> {
  return Promise.all(filePacks().map(async (spec) => {
    const file = packPath(baseFolder, spec.id);
    let installed = false;
    let bytes: number | undefined;
    let entityCount: number | undefined;
    try {
      const stat = await fsp.stat(file);
      installed = stat.isFile();
      bytes = stat.size;
      const manifestPath = path.join(path.dirname(file), 'manifest.json');
      try {
        const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8')) as {
          files?: Record<string, { entityCount?: number }>;
        };
        entityCount = manifest.files?.[path.basename(file)]?.entityCount;
      } catch {
        // Pack files remain usable when their optional manifest is unavailable.
      }
    } catch {
      installed = false;
    }
    return {
      id: spec.id,
      label: spec.label,
      installed,
      bytes,
      entityCount,
    };
  }));
}

export async function installAuthorityPacksFrom(
  sourcePacksRoot: string,
  entityDbFolder: string,
): Promise<{ copied: AuthorityPackId[] }> {
  const destRoot = packsRoot(entityDbFolder);
  await fsp.mkdir(destRoot, { recursive: true });
  const copied: AuthorityPackId[] = [];

  for (const spec of filePacks()) {
    const srcFile = path.join(sourcePacksRoot, spec.relativePath);
    const destFile = packPath(entityDbFolder, spec.id);
    await fsp.mkdir(path.dirname(destFile), { recursive: true });
    await fsp.copyFile(srcFile, destFile);
    copied.push(spec.id);

    const srcManifest = path.join(path.dirname(srcFile), 'manifest.json');
    if (fs.existsSync(srcManifest)) {
      await fsp.copyFile(
        srcManifest,
        path.join(path.dirname(destFile), 'manifest.json'),
      );
    }
  }

  return { copied };
}

/**
 * Read a pack's NDJSON as an array of lines, streamed off disk rather than
 * materialized as one string. Some packs (e.g. CBDB persons) exceed V8's hard
 * ~512MB single-string ceiling (`buffer.constants.MAX_STRING_LENGTH`); a
 * `fsp.readFile(..., 'utf8')` on such a file throws `RangeError: Invalid
 * string length` before the caller ever sees the data. Splitting into lines
 * up front keeps every individual string well under that ceiling regardless
 * of how large the pack grows, and readline never buffers more than one line
 * at a time while reading.
 */
export async function readAuthorityPackFile(
  entityDbFolder: string,
  packId: AuthorityPackId,
): Promise<string[]> {
  try {
    const rl = readline.createInterface({
      input: fs.createReadStream(packPath(entityDbFolder, packId), { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    const lines: string[] = [];
    for await (const line of rl) {
      lines.push(line);
    }
    return lines;
  } catch (error) {
    // Some packs (e.g. the CBDB person concordance) are optional add-ons that
    // may not have been generated yet for an installed source pack. Callers
    // already treat a missing file as "no data available"; returning [] here
    // avoids Electron logging a scary ENOENT for an expected condition.
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw error;
  }
}
