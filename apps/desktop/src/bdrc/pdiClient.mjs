/**
 * BDRC Public Data Interface (LDS-PDI) client.
 *
 * Fetches one etext volume from `purl.bdrc.io` and assembles the corpus-agnostic
 * `ExtractedEtext` that `etextToTei.mjs` consumes. Network shape confirmed
 * 2026-08-31 — see docs/bdrc-import-planning.md §2.2.
 *
 *   Etext_base?R_RES=bdr:<UT>            → access, status, pagination, instance, image group, title
 *   chunkContext?R_UT=bdr:<UT>&I_START&I_END → EC chunks (bdo:chunkContents + slice chars)
 *                                             + EP pages   (bdo:seqNum   + slice chars)
 *   Instance_ImgList?R_RES=bdr:<MW>      → folio labels + image filenames  (TODO: blob format)
 *
 * All calls request `format=nt` (N-Triples) — trivial to parse without a
 * dependency and unambiguous. Predicates are matched by local name so an
 * ontology namespace bump does not break parsing.
 */

import { readCache, writeCache } from './bdrcCache.mjs';

const DEFAULT_BASE_URL = 'https://purl.bdrc.io';
const BDR = 'http://purl.bdrc.io/resource/';
const USER_AGENT = 'LeJeanBaptiste-BDRC-import/0.1 (+https://lejeanbaptiste.org)';
const IMPORTER_VERSION = '0.1.0';
const ATTRIBUTION =
  'Digitised text courtesy of the Buddhist Digital Resource Center (BDRC), https://library.bdrc.io';

const OPEN_ACCESS = new Set(['AccessOpen', 'AccessFairUse']);

/** `bdr:UT…` / full purl / bare id → bare id. */
const bareId = (id) =>
  String(id || '')
    .replace(/^bdr:/, '')
    .replace(/^https?:\/\/purl\.bdrc\.io\/resource\//, '');

const localName = (uri) => {
  const s = String(uri);
  const cut = Math.max(s.lastIndexOf('#'), s.lastIndexOf('/'));
  return cut >= 0 ? s.slice(cut + 1) : s;
};

const stripAngle = (t) => (t.startsWith('<') && t.endsWith('>') ? t.slice(1, -1) : t);

const unescapeLiteral = (t) =>
  t
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');

/**
 * Minimal N-Triples parser. Returns `{ s, p, o, literal, lang, datatype }[]`.
 * @param {string} text
 */
export function parseNTriples(text) {
  const out = [];
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(<[^>]*>|_:[^\s]+)\s+<([^>]*)>\s+(.*?)\s*\.$/);
    if (!m) continue;
    const s = stripAngle(m[1]);
    const p = m[2];
    const rawO = m[3];
    if (rawO.startsWith('<')) {
      out.push({ s, p, o: stripAngle(rawO), literal: false, lang: null, datatype: null });
    } else if (rawO.startsWith('"')) {
      const lm = rawO.match(/^"((?:[^"\\]|\\.)*)"(?:@([\w-]+)|\^\^<([^>]+)>)?$/);
      out.push({
        s,
        p,
        o: lm ? unescapeLiteral(lm[1]) : rawO,
        literal: true,
        lang: lm?.[2] ?? null,
        datatype: lm?.[3] ?? null,
      });
    } else {
      out.push({ s, p, o: rawO, literal: false, lang: null, datatype: null });
    }
  }
  return out;
}

/** Index triples for `(subject, predicateLocalName) → value[]` lookups. */
function indexTriples(triples) {
  /** @type {Map<string, Map<string, Array<{o: string, literal: boolean, lang: string|null}>>>} */
  const bySubj = new Map();
  for (const t of triples) {
    if (!bySubj.has(t.s)) bySubj.set(t.s, new Map());
    const preds = bySubj.get(t.s);
    const key = localName(t.p);
    if (!preds.has(key)) preds.set(key, []);
    preds.get(key).push({ o: t.o, literal: t.literal, lang: t.lang });
  }
  return {
    subjects: () => [...bySubj.keys()],
    all: (subject, predLocal) => bySubj.get(subject)?.get(predLocal) ?? [],
    one: (subject, predLocal) => (bySubj.get(subject)?.get(predLocal) ?? [])[0]?.o,
    hasPred: (subject, predLocal) => (bySubj.get(subject)?.get(predLocal)?.length ?? 0) > 0,
  };
}

async function fetchGraphNt(queryName, params, opts = {}) {
  const base = opts.baseUrl ?? DEFAULT_BASE_URL;
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('No fetch implementation available');
  const qs = new URLSearchParams({ ...params, format: 'nt' });
  const url = `${base}/query/graph/${queryName}?${qs}`;
  const res = await fetchImpl(url, {
    headers: { Accept: 'application/n-triples', 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`BDRC ${queryName} → HTTP ${res.status}`);
  return parseNTriples(await res.text());
}

const num = (v) => (v == null ? null : Number.parseInt(v, 10));

/**
 * The content git revision of an etext, from `/admindata/<UT>`. Used as the
 * cache key (docs §7) — a volume re-imports from cache until BDRC re-syncs it.
 * Returns `''` when the admin graph has no revision (older / unsynced etexts).
 * @param {string} utId
 */
export async function fetchRevision(utId, opts = {}) {
  const ut = bareId(utId);
  const base = opts.baseUrl ?? DEFAULT_BASE_URL;
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') return '';
  try {
    const res = await fetchImpl(`${base}/admindata/${ut}.nt`, {
      headers: { Accept: 'application/n-triples', 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return '';
    const m = (await res.text()).match(/contentsGitRevision>\s+"([^"]+)"/);
    return m?.[1] ?? '';
  } catch {
    return '';
  }
}

/**
 * `Etext_base` → volume-level facts.
 * @returns {Promise<{
 *   utId: string, access: string|null, status: string|null,
 *   paginated: boolean, instanceId: string|null, workId: string|null,
 *   imageGroupId: string|null, title: string, titleLang: string|null
 * }>}
 */
export async function fetchEtextBase(utId, opts = {}) {
  const ut = bareId(utId);
  const idx = indexTriples(await fetchGraphNt('Etext_base', { R_RES: `bdr:${ut}` }, opts));
  const utUri = BDR + ut;

  const accessUri =
    idx.one(utUri, 'access') ??
    idx
      .subjects()
      .map((s) => idx.one(s, 'access'))
      .find(Boolean);
  const statusUri =
    idx.one(utUri, 'status') ??
    idx
      .subjects()
      .map((s) => idx.one(s, 'status'))
      .find(Boolean);

  // UT --eTextInInstance--> IE (EtextInstance)
  //   IE --instanceOf--> WA  (abstract work)
  //   IE --instanceReproductionOf--> W / MW  (scanned instance; MW = the image instance)
  const etextInstanceUri =
    idx.one(utUri, 'eTextInInstance') ?? idx.all(utUri, 'inInstance')[0]?.o ?? null;
  const workUri = etextInstanceUri ? idx.one(etextInstanceUri, 'instanceOf') : null;
  const reproductions = etextInstanceUri
    ? idx.all(etextInstanceUri, 'instanceReproductionOf').map((v) => v.o)
    : [];
  const scanInstanceUri =
    reproductions.find((u) => /\/MW[^/]+$/.test(u)) ?? reproductions[0] ?? null;

  // Image group is not on the UT in Etext_base — it comes from chunkContext.
  const imageGroupUri =
    idx.one(utUri, 'eTextVolumeForImageGroup') ?? idx.one(utUri, 'inImageGroup') ?? null;

  // Title: the etext's own prefLabel is the volume title; fall back to the instance.
  let title = '';
  let titleLang = null;
  for (const subj of [utUri, scanInstanceUri, etextInstanceUri].filter(Boolean)) {
    const label = idx.all(subj, 'prefLabel')[0];
    if (label?.o) {
      title = label.o;
      titleLang = label.lang;
      break;
    }
  }

  return {
    utId: ut,
    access: accessUri ? localName(accessUri) : null,
    status: statusUri ? localName(statusUri) : null,
    paginated: idx.one(utUri, 'etextIsPaginated') === 'true',
    etextInstanceId: etextInstanceUri ? bareId(etextInstanceUri) : null,
    scanInstanceId: scanInstanceUri ? bareId(scanInstanceUri) : null,
    workId: workUri ? bareId(workUri) : null,
    imageGroupId: imageGroupUri ? bareId(imageGroupUri) : null,
    title,
    titleLang,
  };
}

/**
 * Page the `chunkContext` query across the whole volume.
 * @returns {Promise<{
 *   chunks: Array<{ id: string, startChar: number, endChar: number, text: string }>,
 *   pages: Array<{ id: string, seqNum: number|null, startChar: number, endChar: number }>
 * }>}
 */
export async function fetchChunks(utId, opts = {}) {
  const ut = bareId(utId);
  const windowSize = opts.windowSize ?? 20000;
  const maxWindows = opts.maxWindows ?? 5000;

  /** @type {Map<string, { id: string, startChar: number, endChar: number, text: string }>} */
  const chunks = new Map();
  /** @type {Map<string, { id: string, seqNum: number|null, startChar: number, endChar: number }>} */
  const pages = new Map();
  let imageGroupId = null;

  let start = 0;
  for (let i = 0; i < maxWindows; i += 1) {
    const idx = indexTriples(
      await fetchGraphNt(
        'chunkContext',
        { R_UT: `bdr:${ut}`, I_START: String(start), I_END: String(start + windowSize) },
        opts,
      ),
    );

    let advanced = start;
    for (const subj of idx.subjects()) {
      if (!imageGroupId) {
        const ig = idx.one(subj, 'inImageGroup') ?? idx.one(subj, 'eTextVolumeForImageGroup');
        if (ig) imageGroupId = bareId(ig);
      }
      const contents = idx.all(subj, 'chunkContents')[0];
      if (contents) {
        const s = num(idx.one(subj, 'sliceStartChar'));
        const e = num(idx.one(subj, 'sliceEndChar'));
        if (s != null && e != null && !chunks.has(subj)) {
          chunks.set(subj, { id: bareId(subj), startChar: s, endChar: e, text: contents.o });
        }
        if (e != null && e > advanced) advanced = e;
        continue;
      }
      if (idx.hasPred(subj, 'seqNum') && idx.hasPred(subj, 'sliceStartChar')) {
        const s = num(idx.one(subj, 'sliceStartChar'));
        const e = num(idx.one(subj, 'sliceEndChar'));
        if (s != null && e != null && !pages.has(subj)) {
          pages.set(subj, {
            id: bareId(subj),
            seqNum: num(idx.one(subj, 'seqNum')),
            startChar: s,
            endChar: e,
          });
        }
      }
    }

    if (advanced <= start) break; // no progress → whole volume covered
    start = advanced;
  }

  return {
    imageGroupId,
    chunks: [...chunks.values()].sort((a, b) => a.startChar - b.startChar),
    pages: [...pages.values()].sort(
      (a, b) => a.startChar - b.startChar || (a.seqNum ?? 0) - (b.seqNum ?? 0),
    ),
  };
}

/** Concatenate chunk contents in offset order. */
function joinChunkText(chunks) {
  return chunks.map((c) => c.text).join('');
}

/**
 * Re-slice the joined text along page boundaries so each emitted `EtextChunk`
 * is exactly one folio — one clean `<pb/>` per chunk in the emitter.
 */
const IIIF_BASE_URL = 'https://iiif.bdrc.io';

/**
 * IIIF Image API URL for a folio. Confirmed pattern (2026-08-31):
 *   https://iiif.bdrc.io/bdr:<I>::<file>/full/max/0/default.jpg
 * where `<file>` is `<imageGroupId><seqNum padded to 4>.jpg` for the common
 * `<RID><NNNN>.jpg` scan-naming convention. An explicit `imageFiles[seqNum]`
 * from `Instance_ImgList` overrides the guess (older scans use free filenames).
 */
function folioImageUri(imageGroupId, seqNum, imageFiles, baseUrl) {
  if (!imageGroupId || seqNum == null) return undefined;
  const file = imageFiles?.[seqNum] ?? `${imageGroupId}${String(seqNum).padStart(4, '0')}.jpg`;
  return `${baseUrl ?? IIIF_BASE_URL}/bdr:${imageGroupId}::${file}/full/max/0/default.jpg`;
}

function pageAlignedChunks(chunks, pages, { imageGroupId, folioLabels, imageFiles, baseUrl }) {
  const full = joinChunkText(chunks);
  const origin = chunks[0]?.startChar ?? 0;
  const src =
    pages.length > 0
      ? pages
      : [{ id: null, seqNum: null, startChar: origin, endChar: origin + full.length }];

  return src.map((page, index) => {
    const from = Math.max(0, page.startChar - origin);
    const to = page.endChar != null ? Math.max(from, page.endChar - origin) : full.length;
    // TODO(§9.3): real pecha folio labels (1a/1b) need Instance_ImgList; seqNum for now.
    const label =
      folioLabels?.[page.seqNum] ?? (page.seqNum != null ? String(page.seqNum) : String(index + 1));
    const imageUri = folioImageUri(imageGroupId, page.seqNum, imageFiles, baseUrl);
    return {
      index,
      text: full.slice(from, to).replace(/^\uFEFF/, ''), // BOM only on the first folio
      pageId: page.id ?? undefined,
      pageLabel: label,
      imageUri,
      startChar: page.startChar,
      endChar: page.endChar,
    };
  });
}

/**
 * Fetch and assemble one etext volume.
 *
 * @param {string} utId  `bdr:UT…` / bare / purl.
 * @param {{ fetchImpl?: Function, baseUrl?: string, iiifBaseUrl?: string, windowSize?: number,
 *   imgList?: { folioLabels?: Record<number,string>, imageFiles?: Record<number,string> },
 *   cacheDir?: string, forceRefresh?: boolean }} [opts]
 * @returns {Promise<{ extracted: import('./etextToTei.mjs').ExtractedEtext, restricted: boolean, warnings: string[], revision: string, fromCache: boolean }>}
 */
export async function importEtext(utId, opts = {}) {
  const warnings = [];
  const fetchedAt = new Date().toISOString();

  const revision = await fetchRevision(utId, opts);
  if (opts.cacheDir && !opts.forceRefresh) {
    const hit = readCache(opts.cacheDir, utId, revision);
    if (hit)
      return {
        ...hit,
        warnings: [...(hit.warnings ?? []), 'served from local cache'],
        fromCache: true,
      };
  }

  const base = await fetchEtextBase(utId, opts);

  const meta = {
    utId: base.utId,
    instanceId: base.scanInstanceId ?? base.etextInstanceId ?? undefined,
    workId: base.workId ?? undefined,
    volumeId: base.imageGroupId ?? undefined,
    title: base.title || base.utId,
    altTitles: [],
    lang: base.titleLang && /^bo/i.test(base.titleLang) ? 'bo' : 'bo',
    method: 'unknown', // TODO(§9.5): no method predicate on /admindata/<UT|IE>.
    access: base.access ?? undefined,
    facsAllowed: base.access === 'AccessOpen',
    attribution: ATTRIBUTION,
    creators: [], // TODO: from Instance metadata respStmt (docs §4.1).
    sourceUri: `${BDR}${base.utId}`,
    dataRevision: revision,
    fetchedAt,
    importerVersion: IMPORTER_VERSION,
    queryNames: ['Etext_base', 'chunkContext'],
  };

  if (base.status && base.status !== 'StatusReleased') {
    warnings.push(`etext status is ${base.status}, not StatusReleased`);
  }

  if (!base.access || !OPEN_ACCESS.has(base.access)) {
    warnings.push(
      `access tier ${base.access ?? 'unknown'} — content not retrievable, metadata stub only`,
    );
    const stub = {
      extracted: { meta, chunks: [], outline: [] },
      restricted: true,
      warnings,
      revision,
    };
    if (opts.cacheDir) writeCache(opts.cacheDir, utId, revision, stub);
    return { ...stub, fromCache: false };
  }

  const { chunks, pages, imageGroupId } = await fetchChunks(utId, opts);
  if (chunks.length === 0) warnings.push('chunkContext returned no chunks');
  if (pages.length === 0)
    warnings.push('no page slices — pagination will fall back to a single <pb>');

  const volumeId = base.imageGroupId ?? imageGroupId ?? null;
  if (volumeId && !meta.volumeId) meta.volumeId = volumeId;

  const aligned = pageAlignedChunks(chunks, pages, {
    imageGroupId: volumeId,
    folioLabels: opts.imgList?.folioLabels,
    imageFiles: opts.imgList?.imageFiles,
    baseUrl: opts.iiifBaseUrl,
  });

  const result = {
    extracted: { meta, chunks: aligned, outline: [] },
    restricted: false,
    warnings,
    revision,
  };
  if (opts.cacheDir) writeCache(opts.cacheDir, utId, revision, result);
  return { ...result, fromCache: false };
}
