/**
 * Expand ProofreadPage `<pages index="…" from="…" to="…" fromsection="…"
 * tosection="…"/>` transclusion tags into inline wikitext.
 *
 * A work/chapter page on old-style Wikisources (confirmed live 2026-09-03 on
 * bo.wikisource content hosted at wikisource.org) rarely holds its prose
 * directly — instead it embeds this tag, which MediaWiki's ProofreadPage
 * extension expands at render time by stitching together the proofread text
 * of `Page:<index>/<n>` for `n` in `[from, to]`. That expansion never reaches
 * the raw-wikitext API call this importer uses (`action=query&prop=revisions`),
 * so without this module a `<pages/>` tag just passes through as literal,
 * meaningless text — which is why an import of such a page yielded nothing
 * but the `{{header}}` scaffolding around it.
 *
 * Each `Page:` transcription wraps its real text in `<section begin="name"/>`
 * … `<section end="name"/>` markers, with `<noinclude>…</noinclude>` holding
 * only page-furniture (quality flag, running header/footer) around it.
 * `fromsection`/`tosection` — when given — say to start including content only
 * at the named section on the *first* page, and stop at the named section on
 * the *last* page; pages strictly in between are included whole.
 */

import { fetchPageWikitext, getFetchDelayMs, sleep } from './wikisource-parallel.mjs';

const PAGES_TAG_RE = /<pages\b([^>]*)\/?>/gi;
const NOINCLUDE_RE = /<noinclude>[\s\S]*?<\/noinclude>/gi;
const SECTION_TAG_RE = /<section\b[^>]*\/?>/gi;
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

const parseAttrs = (attrString) => {
  const out = {};
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(attrString))) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
};

/**
 * Find `<section begin="name"/>` (`kind: 'begin'`) or `<section end="name"/>`
 * (`kind: 'end'`) and return its span, or `null` if absent.
 */
const findSectionTag = (wikitext, kind, name) => {
  const re = /<section\b([^>]*)\/?>/gi;
  let m;
  while ((m = re.exec(wikitext))) {
    const attrs = parseAttrs(m[1]);
    if (attrs[kind] === name) return { start: m.index, end: m.index + m[0].length };
  }
  return null;
};

/** All `<pages .../>` tags in `wikitext`, parsed and positioned for replacement. */
export function parsePagesTags(wikitext) {
  const tags = [];
  const text = String(wikitext || '');
  let m;
  PAGES_TAG_RE.lastIndex = 0;
  while ((m = PAGES_TAG_RE.exec(text))) {
    const attrs = parseAttrs(m[1]);
    const from = Number.parseInt(attrs.from, 10);
    const to = attrs.to !== undefined ? Number.parseInt(attrs.to, 10) : from;
    if (!attrs.index || !Number.isFinite(from)) continue;
    tags.push({
      raw: m[0],
      index: attrs.index,
      from,
      to: Number.isFinite(to) ? to : from,
      fromsection: attrs.fromsection || null,
      tosection: attrs.tosection || null,
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return tags;
}

/**
 * Strip a `Page:` transcription down to its real text: drop `<noinclude>`
 * furniture, slice to the requested section boundaries (each optional), then
 * drop the now-inert `<section .../>` markers themselves.
 */
export function extractPageContent(rawWikitext, { fromsection, tosection } = {}) {
  let text = String(rawWikitext || '').replace(NOINCLUDE_RE, '');
  if (fromsection) {
    const tag = findSectionTag(text, 'begin', fromsection);
    if (tag) text = text.slice(tag.end);
  }
  if (tosection) {
    const tag = findSectionTag(text, 'end', tosection);
    if (tag) text = text.slice(0, tag.start);
  }
  text = text.replace(SECTION_TAG_RE, '');
  return text.trim();
}

/**
 * Replace every `<pages .../>` tag in `wikitext` with the concatenated,
 * page-broken text of the `Page:` range it names — each page prefixed with
 * `{{pb|n=<n>}}`, which `wikitextToBodyXml`'s existing template handling
 * already turns into a `<pb n="<n>"/>` milestone.
 */
export async function expandPagesTranscription(wikitext, apiHost, opts = {}) {
  const fetchWikitext = opts.fetchPageWikitext ?? fetchPageWikitext;
  const sleepImpl = opts.sleep ?? sleep;
  const delayMs = opts.delayMs ?? getFetchDelayMs();
  const tags = parsePagesTags(wikitext);
  if (!tags.length) return String(wikitext || '');

  let result = String(wikitext);
  // Replace back-to-front so earlier tags' offsets stay valid as we splice.
  for (let t = tags.length - 1; t >= 0; t -= 1) {
    const tag = tags[t];
    const lo = Math.min(tag.from, tag.to);
    const hi = Math.max(tag.from, tag.to);
    const blocks = [];
    let first = true;
    for (let n = lo; n <= hi; n += 1) {
      if (!first) await sleepImpl(delayMs);
      first = false;
      let content = '';
      try {
        const fetched = await fetchWikitext(apiHost, `Page:${tag.index}/${n}`);
        content = extractPageContent(fetched.wikitext, {
          fromsection: n === lo ? tag.fromsection : null,
          tosection: n === hi ? tag.tosection : null,
        });
      } catch {
        content = ''; // a missing/unproofread page contributes only its pb
      }
      blocks.push(`{{pb|n=${n}}}${content}`);
    }
    result = result.slice(0, tag.start) + blocks.join('\n\n') + result.slice(tag.end);
  }
  return result;
}
