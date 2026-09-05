/**
 * Quiet house-style cleanup for translation prose.
 * Runs on plain text nodes only — never inside entity fields or Zotero citations.
 */

const NBSP = '\u00a0';
const EN_DASH = '\u2013';
const ELLIPSIS = '\u2026';
const LDQUO = '\u201C';
const RDQUO = '\u201D';
const LSQUO = '\u2018';
const RSQUO = '\u2019';
const DLQUO = '\u201E'; // German opening „
const LAQUO = '\u00AB'; // «
const RAQUO = '\u00BB'; // »

export type EditorialCleanupLang = 'en' | 'fr' | 'de' | 'other';

export const editorialCleanupLang = (lang: string | null | undefined): EditorialCleanupLang => {
  const code = (lang ?? '').trim().toLowerCase().split(/[-_]/)[0] ?? '';
  if (code === 'fr') return 'fr';
  if (code === 'de') return 'de';
  if (code === 'en') return 'en';
  return 'other';
};

const isWordChar = (ch: string | undefined): boolean => Boolean(ch && /[\p{L}\p{N}]/u.test(ch));

/** Opening vs closing curly double/single quotes (English / fallback). */
const applyCurlyQuotes = (text: string): string => {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (ch === '"' || ch === LDQUO || ch === RDQUO || ch === DLQUO) {
      const prev = out.at(-1);
      const open = !prev || /[\s([{«/\u2014]/.test(prev);
      out += open ? LDQUO : RDQUO;
      continue;
    }
    if (ch === "'" || ch === LSQUO || ch === RSQUO) {
      const prev = out.at(-1);
      const next = text[i + 1];
      if (isWordChar(prev) && isWordChar(next)) {
        out += RSQUO; // don't
        continue;
      }
      if (isWordChar(prev)) {
        out += RSQUO; // possessive / closed contraction
        continue;
      }
      const open = !prev || /[\s([{«/\u2014]/.test(prev);
      out += open ? LSQUO : RSQUO;
      continue;
    }
    out += ch;
  }
  return out;
};

/** German outer quotes: „…“ */
const applyGermanQuotes = (text: string): string => {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (ch === '"' || ch === LDQUO || ch === RDQUO || ch === DLQUO) {
      const prev = out.at(-1);
      const open = !prev || /[\s([{/\u2014]/.test(prev);
      out += open ? DLQUO : LDQUO;
      continue;
    }
    if (ch === "'" || ch === LSQUO || ch === RSQUO) {
      const prev = out.at(-1);
      const next = text[i + 1];
      if (isWordChar(prev) && isWordChar(next)) {
        out += RSQUO;
        continue;
      }
      if (isWordChar(prev)) {
        out += RSQUO;
        continue;
      }
      const open = !prev || /[\s([{/\u2014]/.test(prev);
      out += open ? LSQUO : RSQUO;
      continue;
    }
    out += ch;
  }
  return out;
};

/**
 * French primary quotation marks are guillemets with NBSPs: « mot ».
 * Secondary / leftover singles still get curly apostrophes.
 */
const applyFrenchQuotes = (text: string): string => {
  const out = text
    // Paired straight or curly English doubles → guillemets
    .replace(/[“"„]([^”"«»]*)[”"]/g, `${LAQUO}${NBSP}$1${NBSP}${RAQUO}`)
    // Already-paired guillemets: normalize inner spacing
    .replace(/«\s*/g, `${LAQUO}${NBSP}`)
    .replace(/\s*»/g, `${NBSP}${RAQUO}`);

  // Leftover unpaired straight/curly doubles
  let rebuilt = '';
  for (let i = 0; i < out.length; i += 1) {
    const ch = out[i]!;
    if (ch === '"' || ch === LDQUO || ch === RDQUO || ch === DLQUO) {
      const prev = rebuilt.at(-1);
      const open = !prev || /[\s([{/\u2014]/.test(prev);
      rebuilt += open ? `${LAQUO}${NBSP}` : `${NBSP}${RAQUO}`;
      continue;
    }
    if (ch === "'" || ch === LSQUO || ch === RSQUO) {
      const prev = rebuilt.at(-1);
      const next = out[i + 1];
      if (isWordChar(prev) && isWordChar(next)) {
        rebuilt += RSQUO;
        continue;
      }
      if (isWordChar(prev)) {
        rebuilt += RSQUO;
        continue;
      }
      const open = !prev || /[\s([{«/\u2014]/.test(prev);
      rebuilt += open ? LSQUO : RSQUO;
      continue;
    }
    rebuilt += ch;
  }
  return rebuilt;
};

/** Digit–digit ranges; skip ISO-like 2020-01-01 chains. */
const NUMBER_HYPHEN_RANGE = /(?<![-\d])(\d+)\s*-\s*(\d+)(?![-\d])/g;
const NUMBER_EN_DASH_RANGE = /(?<![–\d])(\d+)\s*–\s*(\d+)(?![–\d])/g;

const applyNumberRangesEnDash = (text: string): string =>
  text.replace(NUMBER_HYPHEN_RANGE, `$1${EN_DASH}$2`);

/** French: ranges stay on the ASCII hyphen (never en dash). */
const applyNumberRangesHyphen = (text: string): string =>
  text.replace(NUMBER_EN_DASH_RANGE, '$1-$2').replace(NUMBER_HYPHEN_RANGE, '$1-$2');

const collapseAsciiSpaces = (text: string): string => text.replace(/ {2,}/g, ' ');

const applyEllipsis = (text: string): string => text.replace(/\.{3,}/g, ELLIPSIS);

/** English / German / other: no space before sentence punctuation. */
const applyTightPunctuation = (text: string): string =>
  text
    .replace(/ +([,.;:!?])/g, '$1')
    .replace(/([([{]) +/g, '$1')
    .replace(/ +([)\]}])/g, '$1');

/**
 * French: NBSP before ; : ! ? and around guillemets;
 * still no space before , .
 */
const applyFrenchPunctuation = (text: string): string =>
  text
    .replace(/ +([,.])/g, '$1')
    .replace(/[\u00a0\u202f ]*([;:!?])/g, `${NBSP}$1`)
    .replace(/«[\u00a0\u202f ]*/g, `${LAQUO}${NBSP}`)
    .replace(/[\u00a0\u202f ]*»/g, `${NBSP}${RAQUO}`)
    .replace(/([(]) +/g, '$1')
    .replace(/ +([)])/g, '$1');

/**
 * Apply editorial cleanup to a single text string for the given language.
 * Pure and safe to unit-test.
 */
export const applyEditorialCleanupToText = (
  text: string,
  lang: string | null | undefined,
): string => {
  if (!text) return text;
  const bucket = editorialCleanupLang(lang);
  let out = applyEllipsis(text);

  if (bucket === 'fr') {
    out = applyFrenchQuotes(out);
    out = applyNumberRangesHyphen(out);
    out = applyFrenchPunctuation(out);
  } else if (bucket === 'de') {
    out = applyGermanQuotes(out);
    out = applyNumberRangesEnDash(out);
    out = applyTightPunctuation(out);
  } else {
    // English and other Romance/default: curly quotes + en-dash ranges for en;
    // "other" still gets curly quotes and tight punctuation, but en-dash only for en.
    out = applyCurlyQuotes(out);
    if (bucket === 'en') out = applyNumberRangesEnDash(out);
    out = applyTightPunctuation(out);
  }

  return collapseAsciiSpaces(out);
};

const isProtectedElement = (element: Element | null): boolean => {
  let el = element;
  while (el) {
    const tag = el.tagName.toLowerCase();
    if (
      tag === 'ref' &&
      (el.getAttribute('type') === 'grognard-entity' || el.getAttribute('type') === 'grognard-date')
    ) {
      return true;
    }
    if (tag === 'bibl' && el.getAttribute('type') === 'zotero-ref') return true;
    el = el.parentElement;
  }
  return false;
};

/**
 * Walk text nodes under `root` and clean each (in place).
 * Skips entity mentions and Zotero citation fields.
 * @returns true if any text node changed.
 */
export const applyEditorialCleanupToRoot = (
  root: ParentNode,
  lang: string | null | undefined,
): boolean => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  let changed = false;
  for (const node of nodes) {
    if (isProtectedElement(node.parentElement)) continue;
    const raw = node.nodeValue ?? '';
    if (!raw) continue;
    const next = applyEditorialCleanupToText(raw, lang);
    if (next !== raw) {
      node.nodeValue = next;
      changed = true;
    }
  }
  return changed;
};

/**
 * Map a caret offset through a string rewrite using a common prefix/suffix split.
 * Caret before the change stays put; caret after the change keeps its distance
 * from the end; caret inside the rewritten span lands at the end of the new span.
 */
export const mapCaretOffsetThroughEdit = (
  before: string,
  after: string,
  offset: number,
): number => {
  if (before === after) return Math.min(offset, after.length);
  const clamped = Math.max(0, Math.min(offset, before.length));

  let prefix = 0;
  const maxPrefix = Math.min(before.length, after.length);
  while (prefix < maxPrefix && before[prefix] === after[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  if (clamped <= prefix) return clamped;
  if (clamped >= before.length - suffix) {
    return after.length - suffix + (clamped - (before.length - suffix));
  }
  return after.length - suffix;
};

/**
 * Like {@link applyEditorialCleanupToRoot}, but keeps the caret/selection inside
 * `root` stable across in-place text rewrites (for live typing).
 */
export const applyEditorialCleanupToRootPreservingSelection = (
  root: ParentNode,
  lang: string | null | undefined,
): boolean => {
  const selection = window.getSelection();
  const range =
    selection && selection.rangeCount > 0 && root.contains(selection.anchorNode)
      ? selection.getRangeAt(0)
      : null;

  const anchorNode = range?.startContainer ?? null;
  const anchorOffset = range?.startOffset ?? 0;
  const isCollapsed = range?.collapsed ?? true;
  const focusNode = range?.endContainer ?? null;
  const focusOffset = range?.endOffset ?? 0;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  let changed = false;
  let nextAnchorOffset = anchorOffset;
  let nextFocusOffset = focusOffset;

  for (const node of nodes) {
    if (isProtectedElement(node.parentElement)) continue;
    const raw = node.nodeValue ?? '';
    if (!raw) continue;
    const next = applyEditorialCleanupToText(raw, lang);
    if (next === raw) continue;
    if (anchorNode === node) {
      nextAnchorOffset = mapCaretOffsetThroughEdit(raw, next, anchorOffset);
    }
    if (focusNode === node) {
      nextFocusOffset = mapCaretOffsetThroughEdit(raw, next, focusOffset);
    }
    node.nodeValue = next;
    changed = true;
  }

  if (changed && range && selection && anchorNode && root.contains(anchorNode)) {
    try {
      const nextRange = document.createRange();
      if (isCollapsed || !focusNode || !root.contains(focusNode)) {
        const offset = Math.min(nextAnchorOffset, (anchorNode.nodeValue ?? '').length);
        nextRange.setStart(anchorNode, offset);
        nextRange.collapse(true);
      } else {
        nextRange.setStart(
          anchorNode,
          Math.min(nextAnchorOffset, (anchorNode.nodeValue ?? '').length),
        );
        nextRange.setEnd(focusNode, Math.min(nextFocusOffset, (focusNode.nodeValue ?? '').length));
      }
      selection.removeAllRanges();
      selection.addRange(nextRange);
    } catch {
      // Node became unusable; leave the browser selection alone.
    }
  }

  return changed;
};
