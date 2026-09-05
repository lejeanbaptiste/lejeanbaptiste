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
 *   resource/<MW>.nt                    → edition statement, publication year, publisher (best-effort)
 *   Instance_ImgList?R_RES=bdr:<MW>      → folio labels + image filenames  (TODO: blob format)
 *
 * All calls request `format=nt` (N-Triples) — trivial to parse without a
 * dependency and unambiguous. Predicates are matched by local name so an
 * ontology namespace bump does not break parsing.
 */

import { readCache, writeCache } from './bdrcCache.mjs';

const DEFAULT_BASE_URL = 'https://purl.bdrc.io';
const BDR = 'http://purl.bdrc.io/resource/';
const USER_AGENT = 'Grognard-BDRC-import/0.1 (+https://grognard.org)';
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
 * A bare / `xsd:gYear` / ISO date literal whose leading component is a 3–4 digit
 * year → zero-padded `"YYYY"`. Anything else (`"乾隆年間"`, `"18th c."`, empty)
 * → `null`, so a fuzzy BDRC date is never emitted as a machine value.
 */
const isoYear = (raw) => {
  const m = String(raw ?? '')
    .trim()
    .match(/^-?(\d{3,4})(?:-\d{2}(?:-\d{2})?)?$/);
  return m ? m[1].padStart(4, '0') : null;
};

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

const isEmptyBase = (base) => !base.access && !base.etextInstanceId && !base.title;

/**
 * `Etext_base` → volume-level facts.
 *
 * `veToUt` (bdrcRef.mjs) always derives the `_0000`-suffixed paginated id,
 * which is correct for natively-hosted BDRC etexts but wrong for OpenPecha
 * batch imports — there, `volumeHasEtext` points straight at the bare
 * `UT<n>_I<ig>` id with no suffix, and the `_0000` variant resolves to
 * nothing. When the `_0000` lookup comes back empty, retry the bare id
 * before concluding the volume has no downloadable transcription (confirmed
 * live against bdr:IE0OPIAC23BB41 2026-09-03). The returned `utId` reflects
 * whichever id actually resolved, so callers should key subsequent requests
 * (chunkContext, revision, cache) off it rather than the input `utId`.
 * @returns {Promise<{
 *   utId: string, access: string|null, status: string|null,
 *   paginated: boolean, instanceId: string|null, workId: string|null,
 *   imageGroupId: string|null, title: string, titleLang: string|null
 * }>}
 */
export async function fetchEtextBase(utId, opts = {}) {
  const ut = bareId(utId);
  const base = await fetchEtextBaseOnce(ut, opts);
  if (isEmptyBase(base) && /_0000$/.test(ut)) {
    const fallback = await fetchEtextBaseOnce(ut.replace(/_0000$/, ''), opts);
    if (!isEmptyBase(fallback)) return fallback;
  }
  return base;
}

async function fetchEtextBaseOnce(ut, opts) {
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
 * Bibliographic facts from a `W`/`MW` instance describe graph
 * (`/resource/<id>.nt`, content-negotiated N-Triples): the edition statement,
 * the publication year (kept only when it is a clean 4-digit year), and the
 * publisher + place. Every field is optional — BDRC's coverage of these is
 * uneven, and a miss here never blocks an import (docs §4.1).
 *
 * The publisher name/place sit on the instance itself; the date sits on a
 * `bdo:PublishedEvent` node (usually a blank node) linked by `bdo:instanceEvent`.
 * Events are matched by `rdf:type` local name so a scan/copy event's dates are
 * never mistaken for the publication date.
 *
 * @param {string} instanceId  bare / `bdr:` / purl `W…` or `MW…`
 * @returns {Promise<{
 *   edition: string, editionLang: string|null,
 *   editionDate: { when?: string, notBefore?: string, notAfter?: string } | null,
 *   publisher: string, pubPlace: string
 * }>}
 */
export async function fetchInstanceBibl(instanceId, opts = {}) {
  const empty = {
    edition: '',
    editionLang: null,
    editionDate: null,
    publisher: '',
    pubPlace: '',
  };
  const id = bareId(instanceId);
  if (!id) return empty;
  const base = opts.baseUrl ?? DEFAULT_BASE_URL;
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') return empty;

  let idx;
  try {
    const res = await fetchImpl(`${base}/resource/${id}.nt`, {
      headers: { Accept: 'application/n-triples', 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return empty;
    idx = indexTriples(parseNTriples(await res.text()));
  } catch {
    return empty;
  }

  /** First non-empty literal for `predLocal` across every subject in the graph. */
  const anyLiteral = (predLocal) => {
    for (const s of idx.subjects()) {
      const hit = idx.all(s, predLocal).find((v) => v.literal && v.o.trim());
      if (hit) return hit;
    }
    return null;
  };

  const editionHit = anyLiteral('editionStatement');
  const publisher = anyLiteral('publisherName')?.o.trim() ?? '';
  const pubPlace = anyLiteral('publisherLocation')?.o.trim() ?? '';

  const publishEvents = idx
    .subjects()
    .filter((s) => idx.all(s, 'type').some((v) => /Publish/i.test(localName(v.o))));

  let editionDate = null;
  for (const s of publishEvents.length ? publishEvents : idx.subjects()) {
    const when = isoYear(idx.one(s, 'onYear'));
    if (when) {
      editionDate = { when };
      break;
    }
  }
  if (!editionDate) {
    for (const s of publishEvents) {
      const notBefore = isoYear(idx.one(s, 'notBefore'));
      const notAfter = isoYear(idx.one(s, 'notAfter'));
      if (notBefore || notAfter) {
        editionDate = {};
        if (notBefore) editionDate.notBefore = notBefore;
        if (notAfter) editionDate.notAfter = notAfter;
        break;
      }
    }
  }

  return {
    edition: editionHit?.o.trim() ?? '',
    editionLang: editionHit?.lang ?? null,
    editionDate,
    publisher,
    pubPlace,
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
  /** most-specific `MW…_NNNN_NN` instance-part id → earliest startChar seen */
  const partStart = new Map();
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
        // Each page carries `tmp:inInstancePart` for every enclosing part
        // (whole text, section, sub-section). The most specific one — the
        // deepest `_N` — is the bam po / fascicle boundary we split on.
        if (s != null) {
          const deepest = idx
            .all(subj, 'inInstancePart')
            .map((v) => bareId(v.o))
            .filter((id) => /_\d+(_\d+)+$/.test(id))
            .sort((a, b) => a.split('_').length - b.split('_').length || a.localeCompare(b))
            .pop();
          if (deepest && (partStart.get(deepest) ?? Infinity) > s) partStart.set(deepest, s);
        }
      }
    }

    if (advanced <= start) break; // no progress → whole volume covered
    start = advanced;
  }

  const parts = [...partStart.entries()]
    .map(([id, s]) => ({ id, startChar: s, label: id.split('_').slice(1).join('.') }))
    .sort((a, b) => a.startChar - b.startChar)
    .map((p, i) => ({ ...p, n: i + 1 }));
  // The first part absorbs any un-tagged prelude (volume title, homage).
  if (parts.length > 0) parts[0] = { ...parts[0], startChar: 0 };

  return {
    imageGroupId,
    parts,
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
    // Entries written before bam-po `parts` were cached lack split boundaries.
    if (hit && Array.isArray(hit.parts)) {
      return {
        ...hit,
        warnings: [...(hit.warnings ?? []), 'served from local cache'],
        fromCache: true,
      };
    }
    if (hit) {
      warnings.push(
        'ignoring stale local cache (missing bam po boundaries) — re-fetching from BDRC',
      );
    }
  }

  const base = await fetchEtextBase(utId, opts);

  // Edition statement + publication year come from the scanned instance's own
  // describe graph — a separate, always-public fetch. Best-effort: a failure or
  // a gap here is a warning at most, never a blocked import (docs §4.1).
  const biblInstanceId = base.scanInstanceId ?? base.etextInstanceId ?? null;
  let bibl = { edition: '', editionLang: null, editionDate: null, publisher: '', pubPlace: '' };
  if (biblInstanceId) {
    try {
      bibl = await fetchInstanceBibl(biblInstanceId, opts);
    } catch {
      warnings.push('could not read edition / publication metadata from the BDRC instance record');
    }
  }

  const meta = {
    utId: base.utId,
    instanceId: base.scanInstanceId ?? base.etextInstanceId ?? undefined,
    instanceUri: base.scanInstanceId ? `${BDR}${base.scanInstanceId}` : undefined,
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
    edition: bibl.edition || undefined,
    editionLang: bibl.editionLang || undefined,
    editionDate: bibl.editionDate ?? undefined,
    publisher: bibl.publisher || undefined,
    pubPlace: bibl.pubPlace || undefined,
    sourceUri: `${BDR}${base.utId}`,
    readerUrl: opts.readerUrl || undefined,
    dataRevision: revision,
    fetchedAt,
    importerVersion: IMPORTER_VERSION,
    queryNames: biblInstanceId
      ? ['Etext_base', 'chunkContext', 'resource']
      : ['Etext_base', 'chunkContext'],
  };

  // A real BDRC transcription carries at least an access tier or an instance
  // link. A near-empty Etext_base — even after fetchEtextBase's own `_0000`
  // fallback — means the id resolves to nothing usable: a genuine OpenPecha /
  // pecha.org volume BDRC has no paginated etext for at all (planning §9).
  if (isEmptyBase(base)) {
    warnings.push(
      'no etext metadata for this id — the volume has no downloadable transcription ' +
        '(BDRC serves OpenPecha / pecha.org texts differently)',
    );
    const stub = {
      extracted: { meta, chunks: [], outline: [] },
      restricted: true,
      unsupported: true,
      warnings,
      revision,
    };
    return { ...stub, fromCache: false };
  }

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

  // base.utId is whichever id fetchEtextBase actually resolved to — the
  // requested id, or its `_0000`-stripped fallback — so chunkContext (keyed
  // by the same UT) must follow it, not the raw input utId.
  const { chunks, pages, imageGroupId, parts } = await fetchChunks(base.utId, opts);
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
    parts: parts ?? [],
    restricted: false,
    warnings,
    revision,
  };
  if (opts.cacheDir) writeCache(opts.cacheDir, utId, revision, result);
  return { ...result, fromCache: false };
}

/** Fascicle-level UT ids end with `_<parent>_<n>` (e.g. `…_0001_3`), not the combined `_0001`. */
const isFascicleEtextId = (utId) => /_\d+_\d+$/.test(String(utId ?? ''));

const fascicleSeq = (utId) => {
  const m = String(utId ?? '').match(/_(\d+)$/);
  return m ? Number.parseInt(m[1], 10) : 0;
};

/**
 * List the per–bam po etext ids BDRC publishes for one scanned volume (`VE…`).
 * Kangyur volumes expose both one combined UT and separate fascicle UTs; prefer
 * the fascicles when there are ≥2.
 * @param {string} veId  bare or prefixed `VE<n>_I<ig>`
 * @returns {Promise<Array<{ utId: string, n: number, label: string, seqNum: number }>>}
 */
export async function fetchVolumeBampoEtexts(veId, opts = {}) {
  const ve = bareId(veId);
  const idx = indexTriples(await fetchGraphNt('Etext_base', { R_RES: `bdr:${ve}` }, opts));
  const resource = `${BDR}${ve}`;
  const utIds = idx
    .all(resource, 'volumeHasEtext')
    .map((v) => bareId(v.o))
    .filter(isFascicleEtextId);
  if (utIds.length < 2) return [];

  const entries = await Promise.all(
    utIds.map(async (utId) => {
      const base = await fetchEtextBase(utId, opts);
      const seqNum = fascicleSeq(utId);
      return {
        utId,
        n: seqNum,
        seqNum,
        label: base.title || utId,
      };
    }),
  );
  return entries.sort((a, b) => a.seqNum - b.seqNum || a.utId.localeCompare(b.utId));
}
