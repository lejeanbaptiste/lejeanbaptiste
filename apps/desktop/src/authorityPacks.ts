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
  getAuthorityPackSpec,
  type AuthorityPackId,
  type AuthorityPackDateFilter,
  type AuthorityPackStatus,
  packPath,
  packsRoot,
} from '../../commons/src/desktop/authorityPackTypes';

/** File-backed specs only — pedb/cedb/project/list packs are read live, never on disk. */
const filePacks = () =>
  AUTHORITY_PACKS.filter((spec) => !spec.virtual && authorityPackOrigin(spec) === 'file');

export {
  AUTHORITY_PACKS_DIRNAME,
  AUTHORITY_PACKS,
  authorityPackOrigin,
  type AuthorityPackId,
  type AuthorityPackStatus,
  packPath,
  packsRoot,
} from '../../commons/src/desktop/authorityPackTypes';

export async function getAuthorityPackStatuses(baseFolder: string): Promise<AuthorityPackStatus[]> {
  return Promise.all(
    filePacks().map(async (spec) => {
      const file = packPath(baseFolder, spec.id);
      let installed = false;
      let bytes: number | undefined;
      let entityCount: number | undefined;
      let attribution: string | undefined;
      try {
        const stat = await fsp.stat(file);
        installed = stat.isFile();
        bytes = stat.size;
        const manifestPath = path.join(path.dirname(file), 'manifest.json');
        try {
          const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8')) as {
            files?: Record<string, { entityCount?: number }>;
            attribution?: string;
          };
          entityCount = manifest.files?.[path.basename(file)]?.entityCount;
          attribution = manifest.attribution;
        } catch {
          // Pack files remain usable when their optional manifest is unavailable.
        }
      } catch {
        // stat failed — the pack file is absent, so the `false` initializer stands.
      }
      return {
        id: spec.id,
        label: spec.label,
        installed,
        bytes,
        entityCount,
        source: spec.source,
        attribution,
      };
    }),
  );
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
    if (!fs.existsSync(srcFile)) continue;
    const destFile = packPath(entityDbFolder, spec.id);
    await fsp.mkdir(path.dirname(destFile), { recursive: true });
    await fsp.copyFile(srcFile, destFile);
    copied.push(spec.id);

    const srcManifest = path.join(path.dirname(srcFile), 'manifest.json');
    if (fs.existsSync(srcManifest)) {
      await fsp.copyFile(srcManifest, path.join(path.dirname(destFile), 'manifest.json'));
    }
  }

  return { copied };
}

interface DateChunkLayout {
  version: 1;
  blockYears: number;
  chunks: { path: string; start: number; end: number }[];
  undatedPath?: string;
  includeUndatedForLimit?: boolean;
}

/** Absolute paths of NDJSON files that make up a pack for the given filter. */
async function resolveAuthorityPackDataFiles(
  entityDbFolder: string,
  packId: AuthorityPackId,
  dateFilter?: AuthorityPackDateFilter,
): Promise<string[]> {
  const file = packPath(entityDbFolder, packId);
  try {
    const manifestPath = path.join(path.dirname(file), 'manifest.json');
    const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8')) as {
      files?: Record<string, { dateChunks?: DateChunkLayout }>;
    };
    const chunkLayout = manifest.files?.[path.basename(file)]?.dateChunks;
    if (chunkLayout) {
      const sorted = [...chunkLayout.chunks].sort((a, b) => a.start - b.start);
      const requested =
        dateFilter?.mode === 'limit'
          ? {
              start: Math.min(dateFilter.start, dateFilter.end),
              end: Math.max(dateFilter.start, dateFilter.end),
            }
          : null;
      const selectedIndexes = requested
        ? sorted
            .map((chunk, index) =>
              chunk.start <= requested.end && chunk.end >= requested.start ? index : -1,
            )
            .filter((index) => index >= 0)
        : sorted.map((_, index) => index);
      const selected = new Set<number>();
      for (const index of selectedIndexes) {
        for (
          let candidate = Math.max(0, index - 2);
          candidate <= Math.min(sorted.length - 1, index + 2);
          candidate += 1
        ) {
          selected.add(candidate);
        }
      }
      const paths = [...selected].sort((a, b) => a - b).map((index) => sorted[index]!.path);
      if (chunkLayout.undatedPath && (!requested || chunkLayout.includeUndatedForLimit)) {
        paths.push(chunkLayout.undatedPath);
      }
      return paths.map((relative) => path.resolve(path.dirname(file), relative));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
    // Legacy layouts have no manifest; fall through to the single file.
  }
  return [file];
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
  dateFilter?: AuthorityPackDateFilter,
): Promise<string[]> {
  if (!getAuthorityPackSpec(packId)) return [];
  const files = await resolveAuthorityPackDataFiles(entityDbFolder, packId, dateFilter);
  if (files.length === 1) return readAuthorityPackLines(files[0]!);
  // Read selected chunks one at a time. Promise.all + flat() briefly held
  // the same large pack as nested arrays, a flattened array, and a Set;
  // with a broad undated section that could push the renderer over V8's
  // large-string/memory limits even though the date filter was working.
  const uniqueLines = new Set<string>();
  for (const file of files) {
    for (const line of await readAuthorityPackLines(file)) uniqueLines.add(line);
  }
  return [...uniqueLines];
}

/**
 * Stream a pack in the main process and return only rows whose `authorityId`
 * is in `authorityIds`. Used by bulk backfill so the renderer never receives
 * the full ~570MB CBDB persons pack over IPC.
 */
export async function lookupAuthorityPackRowsByIds(
  entityDbFolder: string,
  packId: AuthorityPackId,
  authorityIds: string[],
): Promise<string[]> {
  if (!getAuthorityPackSpec(packId)) return [];
  const wanted = new Set(
    authorityIds.map((id) => String(id ?? '').trim()).filter((id) => id.length > 0),
  );
  if (wanted.size === 0) return [];

  const files = await resolveAuthorityPackDataFiles(entityDbFolder, packId);
  const found = new Map<string, string>();

  for (const file of files) {
    if (found.size >= wanted.size) break;
    try {
      const rl = readline.createInterface({
        input: fs.createReadStream(file, { encoding: 'utf8' }),
        crlfDelay: Infinity,
      });
      for await (const line of rl) {
        if (!line || line.charCodeAt(0) !== 123 /* { */) continue;
        let authorityId: string;
        try {
          authorityId = String(
            (JSON.parse(line) as { authorityId?: unknown }).authorityId ?? '',
          ).trim();
        } catch {
          continue;
        }
        if (!authorityId || !wanted.has(authorityId) || found.has(authorityId)) continue;
        found.set(authorityId, line);
        if (found.size >= wanted.size) {
          rl.close();
          break;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') continue;
      throw error;
    }
  }

  return [...found.values()];
}

async function readAuthorityPackLines(file: string): Promise<string[]> {
  try {
    const rl = readline.createInterface({
      input: fs.createReadStream(file, { encoding: 'utf8' }),
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
