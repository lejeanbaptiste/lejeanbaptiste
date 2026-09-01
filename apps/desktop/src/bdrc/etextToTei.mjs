/**
 * BDRC etext → TEI body fragment.
 *
 * Input is an `ExtractedEtext` (normalised, corpus-agnostic — the PDI client in
 * `pdiClient.mjs` produces it from the raw `UT` graph). Output is a body XML
 * fragment plus the header fields the host maps into `<teiHeader>` via
 * `buildSkeletonForCatalog()`.
 *
 * Design: docs/bdrc-import-planning.md §4.
 *
 * The volume is emitted as one `<ab>` block per folio, each opening with its
 * `<pb/>` and containing that folio's `<lb/>`-separated lines. (It was
 * previously a single `<p>` for the whole text; see `renderPageBlocks` for why
 * that had to change.) Tibetan punctuation (tsheg ་, shad །, ༎) is content — kept verbatim,
 * never converted to `<pc>` and never used to split blocks. When the extract
 * carries an outline whose nodes all have character offsets, the body is cut
 * into `<div type="…">` at those offsets instead (docs §4.2).
 *
 * @typedef {Object} EtextChunk
 * @property {number} index      Slice order within the volume.
 * @property {string} text       Chunk text; may contain "\n" line breaks.
 * @property {string} [pageId]   `I…` image resource id of the folio this chunk opens.
 * @property {string} [pageLabel] Folio label, e.g. "1a", "2b", "14".
 * @property {string} [imageUri] IIIF Image API URL for the folio.
 * @property {number} [startChar] Offset within the volume (for outline cuts).
 * @property {number} [endChar]
 *
 * @typedef {Object} EtextOutlineNode
 * @property {string} type       BDRC outline node type (kept as `@type`).
 * @property {string} [label]    Heading text.
 * @property {number} startChar  Volume offset where the node begins.
 * @property {number} [level]
 *
 * @typedef {Object} EtextCreator
 * @property {string} name       Display name (Tibetan / Uchen preferred).
 * @property {string} [id]       `P…` resource id (no `bdr:` prefix).
 * @property {string} [lang]     BCP-47 tag for the name form.
 * @property {string} role       "author" | "translator" | "scribe" | "reviser" | …
 *
 * @typedef {Object} EtextMeta
 * @property {string} utId
 * @property {string} [instanceId]  `W…` / `MW…`
 * @property {string} [instanceUri] Purl of the scanned instance (`MW…`).
 * @property {string} [workId]      `WA…`
 * @property {string} [volumeId]    `I…`
 * @property {number} [volumeNumber]
 * @property {string} title         Primary (Tibetan) title.
 * @property {Array<{text: string, lang?: string}>} [altTitles]
 * @property {string} [lang]        Default "bo".
 * @property {'ocr'|'manual'|'unknown'} [method]
 * @property {string} [access]      "AccessOpen" | "AccessFairUse" | "AccessRestrictedByTbrc" | …
 * @property {boolean} [facsAllowed] Whether `<pb @facs>` may point at the image.
 * @property {string} [attribution] Required credit string, kept verbatim.
 * @property {EtextCreator[]} [creators]
 * @property {string} [edition]      BDRC edition statement (often Tibetan), verbatim.
 * @property {string} [editionLang]  BCP-47 tag for `edition`.
 * @property {{when?: string, notBefore?: string, notAfter?: string}} [editionDate]
 *   Publication year, ISO — only when BDRC carries a clean 4-digit year.
 * @property {string} [publisher]    Publisher name (often Tibetan).
 * @property {string} [pubPlace]     Publication place.
 * @property {string} sourceUri     "http://purl.bdrc.io/resource/UT…"
 * @property {string} [readerUrl]    The BUDA reader URL the import was launched from, when known.
 * @property {string} [dataRevision]
 * @property {string} [fetchedAt]   ISO timestamp.
 * @property {string} [importerVersion]
 * @property {string[]} [queryNames]
 *
 * @typedef {Object} ExtractedEtext
 * @property {EtextMeta} meta
 * @property {EtextChunk[]} chunks
 * @property {EtextOutlineNode[]} [outline]
 */

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escapeAttr = (value) => escapeXml(value).replace(/"/g, '&quot;');

/** Line breaks inside one chunk → `<lb/>` milestones; text escaped. */
const chunkInlineXml = (text) =>
  String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => escapeXml(line))
    .join('<lb/>\n');

const pbXml = (chunk, facsAllowed) => {
  const n = chunk.pageLabel ? ` n="${escapeAttr(chunk.pageLabel)}"` : '';
  const facs = facsAllowed && chunk.imageUri ? ` facs="${escapeAttr(chunk.imageUri)}"` : '';
  return `<pb${n}${facs}/>`;
};

const sortedChunks = (chunks) =>
  [...(chunks ?? [])]
    .filter((c) => c && String(c.text ?? '').length > 0)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

/**
 * Render chunks as one `<ab>` block per folio, each opening with its `<pb/>`
 * and carrying that folio's `<lb/>`-separated lines.
 *
 * BDRC etexts arrive as one undifferentiated run of text. Emitting that as a
 * single `<p>` put an entire fascicle in one block — measured at ~396k
 * characters and ~3.6k children for the largest volume in MW4CZ5369. Editors
 * pay layout, caret and selection costs per block, so one enormous block makes
 * Visual mode unusable, while a folio-sized block (~1.5k characters, ~7
 * children here) is unremarkable. Splitting on the folio is what makes the
 * difference; the milestone count itself was never the problem.
 *
 * `<ab>` (anonymous block) rather than `<p>`: a folio is a physical page
 * division, not a rhetorical paragraph, and a sentence may legitimately run
 * across the boundary.
 *
 * BDRC only. The Kanripo/Daozang/CBETA importers build their bodies in their
 * own modules and are deliberately left as they are.
 */
const renderPageBlocks = (chunks, facsAllowed) => {
  const blocks = [];
  let current = null;
  let lastPageKey = null;

  for (const chunk of chunks) {
    const pageKey = chunk.pageId ?? chunk.pageLabel ?? null;
    if (pageKey !== null && pageKey !== lastPageKey) {
      if (current) blocks.push(current);
      current = { pb: pbXml(chunk, facsAllowed), parts: [] };
      lastPageKey = pageKey;
    }
    // Text before the first folio marker still needs a block to live in.
    if (!current) current = { pb: '', parts: [] };
    current.parts.push(chunkInlineXml(chunk.text));
  }
  if (current) blocks.push(current);

  return blocks
    .map(({ pb, parts }) => `<ab>${pb ? `${pb}\n` : ''}${parts.join('')}</ab>`)
    .join('\n');
};

const canUseOutline = (outline, chunks) =>
  Array.isArray(outline) &&
  outline.length > 0 &&
  outline.every((node) => Number.isFinite(node?.startChar)) &&
  chunks.every((c) => Number.isFinite(c?.startChar));

/** Split the flat body into `<div>`s at outline offsets (docs §4.2). */
const renderWithOutline = (chunks, outline, facsAllowed) => {
  const nodes = [...outline].sort((a, b) => a.startChar - b.startChar);
  const divs = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const nextStart = i + 1 < nodes.length ? nodes[i + 1].startChar : Infinity;
    const slice = chunks.filter((c) => c.startChar >= node.startChar && c.startChar < nextStart);
    const head = node.label ? `<head>${escapeXml(node.label)}</head>` : '';
    const runs = renderPageBlocks(slice, facsAllowed);
    divs.push(`<div type="${escapeAttr(node.type || 'section')}">${head}${runs}</div>`);
  }
  // Chunks before the first outline node, if any, go in a leading untyped div.
  const preludeEnd = nodes[0].startChar;
  const prelude = chunks.filter((c) => c.startChar < preludeEnd);
  if (prelude.length > 0) {
    divs.unshift(`<div>${renderPageBlocks(prelude, facsAllowed)}</div>`);
  }
  return divs.join('');
};

/**
 * @param {ExtractedEtext} extracted
 * @param {{ forceFlat?: boolean }} [options]
 * @returns {{ bodyXml: string, pbCount: number, hasFacs: boolean, lang: string, structure: 'flat'|'outline' }}
 */
export function etextToBodyXml(extracted, options = {}) {
  const meta = extracted?.meta ?? {};
  const lang = meta.lang || 'bo';
  const facsAllowed = meta.facsAllowed === true;
  const chunks = sortedChunks(extracted?.chunks);
  const outline = extracted?.outline ?? [];

  let bodyXml;
  let structure = 'flat';
  if (!options.forceFlat && canUseOutline(outline, chunks)) {
    bodyXml = renderWithOutline(chunks, outline, facsAllowed);
    structure = 'outline';
  } else {
    bodyXml = renderPageBlocks(chunks, facsAllowed);
  }
  if (!bodyXml || /^<p>\s*<\/p>$/.test(bodyXml)) bodyXml = '<p></p>';

  const pbCount = (bodyXml.match(/<pb\b/g) || []).length;
  const hasFacs = /<pb\b[^>]*\sfacs=/.test(bodyXml);
  return { bodyXml, pbCount, hasFacs, lang, structure };
}

const AVAILABILITY = {
  AccessOpen: 'free',
  AccessFairUse: 'restricted',
  AccessRestrictedByTbrc: 'restricted',
  AccessRestrictedInChina: 'restricted',
  AccessRestrictedSealed: 'restricted',
};

/**
 * Header fields for the host to fold into `<teiHeader>`. Pure data — no XML
 * assembly here; the skeleton builder owns element placement.
 *
 * @param {ExtractedEtext} extracted
 * @returns {{
 *   title: string,
 *   altTitles: Array<{text: string, lang?: string}>,
 *   lang: string,
 *   creators: Array<{name: string, ref?: string, role: string, lang?: string}>,
 *   idno: Array<{type: string, value: string}>,
 *   sourceUri: string,
 *   readerUrl: string,
 *   edition: string,
 *   editionLang: string,
 *   editionDate: {when?: string, notBefore?: string, notAfter?: string} | null,
 *   publisher: string,
 *   pubPlace: string,
 *   availabilityStatus: string,
 *   accessTier: string | null,
 *   attribution: string | null,
 *   transcriptionMethod: string,
 *   reviewNeeded: boolean,
 *   provenance: Record<string, string>
 * }}
 */
export function etextHeaderFields(extracted) {
  const meta = extracted?.meta ?? {};
  const purl = (id) => `http://purl.bdrc.io/resource/${String(id).replace(/^bdr:/, '')}`;

  const idno = [];
  if (meta.utId) idno.push({ type: 'URI', value: purl(meta.utId) });
  if (meta.instanceId) idno.push({ type: 'BDRC', value: meta.instanceId });
  if (meta.workId) idno.push({ type: 'BDRC-work', value: meta.workId });
  if (meta.volumeId) idno.push({ type: 'BDRC-volume', value: meta.volumeId });

  const creators = (meta.creators ?? []).map((c) => ({
    name: c.name,
    ...(c.id ? { ref: purl(c.id) } : {}),
    role: c.role || 'unknown',
    ...(c.lang ? { lang: c.lang } : {}),
  }));

  const method = meta.method || 'unknown';
  const provenance = {
    utId: meta.utId ?? '',
    instanceId: meta.instanceId ?? '',
    volumeId: meta.volumeId ?? '',
    dataRevision: meta.dataRevision ?? '',
    fetchedAt: meta.fetchedAt ?? '',
    importerVersion: meta.importerVersion ?? '',
    queryNames: (meta.queryNames ?? []).join(', '),
    transcriptionMethod: method,
  };

  const editionDate = meta.editionDate ?? null;

  return {
    title: meta.title ?? '',
    altTitles: meta.altTitles ?? [],
    lang: meta.lang || 'bo',
    creators,
    idno,
    sourceUri: meta.sourceUri ?? (meta.utId ? purl(meta.utId) : ''),
    readerUrl: meta.readerUrl ?? '',
    edition: meta.edition ?? '',
    editionLang: meta.editionLang ?? '',
    editionDate:
      editionDate && (editionDate.when || editionDate.notBefore || editionDate.notAfter)
        ? editionDate
        : null,
    publisher: meta.publisher ?? '',
    pubPlace: meta.pubPlace ?? '',
    availabilityStatus: AVAILABILITY[meta.access] ?? 'unknown',
    accessTier: meta.access ?? null,
    attribution: meta.attribution ?? null,
    transcriptionMethod: method,
    reviewNeeded: method === 'ocr',
    provenance,
  };
}

/** True when the volume's content is access-restricted and only a metadata stub can be imported. */
export function isContentRestricted(extracted) {
  const access = extracted?.meta?.access;
  return typeof access === 'string' && access !== 'AccessOpen' && access !== 'AccessFairUse';
}
