/**
 * Main-process entry for BDRC import. `main.ts` dynamically `import()`s this
 * module (same pattern as `wikisourceImport.mjs`) and exposes the two calls
 * below over IPC. Everything network- and TEI-shaped happens here; the
 * renderer only wraps the returned body in the project skeleton and writes it.
 */

import path from 'node:path';
import { app } from 'electron';
import { fetchEtextBase, importEtext } from './pdiClient.mjs';
import { etextToBodyXml, etextHeaderFields } from './etextToTei.mjs';
import { parseBdrcRef } from './bdrcRef.mjs';
import { clearCache } from './bdrcCache.mjs';

const OPEN_ACCESS = new Set(['AccessOpen', 'AccessFairUse']);

/** `<userData>/bdrc-cache` — safe to delete; the app `.gitignore`s nothing here. */
const cacheDir = () => {
  try {
    return path.join(app.getPath('userData'), 'bdrc-cache');
  } catch {
    return undefined; // no electron app (tests) → cache disabled
  }
};

/**
 * Cheap preview — one `Etext_base` call, no text fetch.
 * @param {string} input  id / purl / reader URL
 */
export async function inspectBdrcEtext(input) {
  const { utId } = parseBdrcRef(input);
  const base = await fetchEtextBase(utId, {});
  return {
    utId: base.utId,
    title: base.title,
    titleLang: base.titleLang,
    access: base.access,
    status: base.status,
    restricted: !base.access || !OPEN_ACCESS.has(base.access),
    workId: base.workId,
    instanceId: base.scanInstanceId ?? base.etextInstanceId ?? null,
    imageGroupId: base.imageGroupId,
    paginated: base.paginated,
  };
}

/**
 * Full import: fetch the volume (or read the local cache), emit the TEI body
 * + header fields.
 * @param {string} input
 * @param {{ windowSize?: number, forceRefresh?: boolean }} [opts]
 * @returns {Promise<{
 *   restricted: boolean,
 *   warnings: string[],
 *   fromCache: boolean,
 *   revision: string,
 *   meta: object,
 *   bodyXml: string,
 *   headerFields: object,
 *   pbCount: number,
 *   structure: 'flat'|'outline'
 * }>}
 */
export async function runBdrcImport(input, opts = {}) {
  const { utId } = parseBdrcRef(input);
  const dir = cacheDir();
  if (opts.forceRefresh && dir) clearCache(dir, utId);

  const { extracted, restricted, warnings, revision, fromCache } = await importEtext(utId, {
    windowSize: opts.windowSize,
    cacheDir: dir,
    forceRefresh: opts.forceRefresh === true,
  });
  const { bodyXml, pbCount, structure } = etextToBodyXml(extracted);
  return {
    restricted,
    warnings,
    fromCache: fromCache === true,
    revision: revision ?? '',
    meta: extracted.meta,
    bodyXml,
    headerFields: etextHeaderFields(extracted),
    pbCount,
    structure,
  };
}
