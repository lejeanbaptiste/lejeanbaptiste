/**
 * Main-process entry for BDRC import. `main.ts` dynamically `import()`s this
 * module (same pattern as `wikisourceImport.mjs`) and exposes the two calls
 * below over IPC. Everything network- and TEI-shaped happens here; the
 * renderer only wraps the returned body in the project skeleton and writes it.
 */

import path from 'node:path';
import { app } from 'electron';
import { fetchEtextBase, fetchVolumeBampoEtexts, importEtext } from './pdiClient.mjs';
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
  const { utId, from, sourceId } = parseBdrcRef(input);
  const base = await fetchEtextBase(utId, {});
  const unsupported = !base.access && !base.etextInstanceId && !base.title;
  let bampoCount = 0;
  if (from === 've' && !unsupported && base.access && OPEN_ACCESS.has(base.access)) {
    try {
      bampoCount = (await fetchVolumeBampoEtexts(sourceId, {})).length;
    } catch {
      bampoCount = 0;
    }
  }
  return {
    utId: base.utId,
    sourceId,
    from,
    veId: from === 've' ? sourceId : null,
    title: base.title,
    titleLang: base.titleLang,
    access: base.access,
    status: base.status,
    unsupported,
    restricted: unsupported || !base.access || !OPEN_ACCESS.has(base.access),
    workId: base.workId,
    instanceId: base.scanInstanceId ?? base.etextInstanceId ?? null,
    imageGroupId: base.imageGroupId,
    paginated: base.paginated,
    bampoCount,
  };
}

/** Slice the page-aligned chunks into one `ExtractedEtext` per bam po. */
function splitByParts(extracted, parts) {
  const bounds = parts
    .map((p, i) => ({
      n: p.n,
      label: p.label,
      start: p.startChar,
      end: i + 1 < parts.length ? parts[i + 1].startChar : Infinity,
    }))
    .filter((b) => Number.isFinite(b.start));
  return bounds.map((b) => ({
    n: b.n,
    label: b.label,
    extracted: {
      meta: extracted.meta,
      outline: [],
      chunks: extracted.chunks.filter((c) => c.startChar >= b.start && c.startChar < b.end),
    },
  }));
}

/**
 * Full import: fetch the volume (or read the local cache), emit the TEI body
 * + header fields. When `split` and the volume has ≥2 bam po, `sections` holds
 * one entry per bam po; otherwise a single entry with `n: null`.
 *
 * Per-fascicle UT ids (from `volumeHasEtext`) do not carry chunk text in PDI;
 * we always fetch the combined paginated UT (`…_0000`) and slice by
 * `inInstancePart` character offsets when splitting.
 * @param {string} input
 * @param {{ windowSize?: number, forceRefresh?: boolean, split?: boolean }} [opts]
 */
export async function runBdrcImport(input, opts = {}) {
  const { utId } = parseBdrcRef(input);
  const dir = cacheDir();
  if (opts.forceRefresh && dir) clearCache(dir, utId);

  const wantSplit = opts.split !== false;

  const { extracted, parts, restricted, unsupported, warnings, revision, fromCache } =
    await importEtext(utId, {
      windowSize: opts.windowSize,
      cacheDir: dir,
      forceRefresh: opts.forceRefresh === true,
    });

  const headerFields = etextHeaderFields(extracted);
  const base = {
    restricted,
    unsupported: unsupported === true,
    warnings,
    fromCache: fromCache === true,
    revision: revision ?? '',
    meta: extracted.meta,
    headerFields,
    partCount: (parts ?? []).length,
  };

  if (restricted || unsupported) {
    return { ...base, sections: [] };
  }

  const doSplit = wantSplit && (parts ?? []).length >= 2;
  if (wantSplit && !doSplit && (parts ?? []).length < 2) {
    warnings.push(
      'Could not split into bam po — part boundaries were missing. Turn on “Re-fetch from BDRC” and import again.',
    );
  }
  const pieces = doSplit ? splitByParts(extracted, parts) : [{ n: null, label: '', extracted }];

  const sections = pieces.map((piece) => {
    const { bodyXml, pbCount, structure } = etextToBodyXml(piece.extracted);
    return { n: piece.n, label: piece.label, bodyXml, pbCount, structure };
  });

  return { ...base, split: doSplit, sections };
}
