/** Count TEI page/line milestones that explode the visual editor node tree. */
export const countTeiMilestones = (xml: string): number => {
  if (!xml) return 0;
  const matches = xml.match(/<(lb|pb)\b/gi);
  return matches?.length ?? 0;
};

const BDRC_IMPORT_SEGMENT = '/imported/bdrc/';

/** Elements that open or close a block, i.e. that bound a unit of layout work. */
const BLOCK_BOUNDARY = /<\/?(?:p|ab|div|lg|l|head|item|list|q|quote|sp|body|text|note|bibl)\b/gi;

/** Characters in the longest stretch of markup uninterrupted by a block boundary. */
export const largestBlockLength = (xml: string): number => {
  if (!xml) return 0;
  let last = 0;
  let max = 0;
  for (const match of xml.matchAll(BLOCK_BOUNDARY)) {
    if (match.index - last > max) max = match.index - last;
    last = match.index;
  }
  return Math.max(max, xml.length - last);
};

/**
 * A block this size is comfortable for the visual editor. BDRC fascicles split
 * one `<ab>` per folio peak at ~1.9k characters, while the single-`<p>`-per-
 * volume shape they replaced ran to ~1.2M — so anything in between is safe.
 */
const SAFE_BLOCK_LENGTH = 20_000;

/**
 * Large BDRC volumes carry a `<pb/>` per folio and `<lb/>` per line. The visual
 * editor walks every node when building TinyMCE markup and can run out of memory.
 * Prefer Source mode for those documents (import, reopen, and tab restore).
 */
export const shouldOpenTeiInSourceMode = (xml: string, filePath?: string): boolean => {
  // Milestone count is only a proxy. What actually strains the visual editor is
  // a single enormous block: the browser re-runs line breaking over the whole
  // thing on every edit, and the editor walks all its children for caret and
  // selection work. A document already cut into modest blocks is cheap to edit
  // no matter how many `<lb/>`s it carries, so exempt it before the count-based
  // rules below. This only ever relaxes the guard - nothing that used to open
  // in visual mode is newly forced into source mode.
  if (largestBlockLength(xml) < SAFE_BLOCK_LENGTH) return false;

  const milestones = countTeiMilestones(xml);
  if (milestones >= 100) return true;
  if (xml.length >= 500_000 && milestones >= 20) return true;
  const normalized = filePath?.replace(/\\/g, '/').toLowerCase() ?? '';
  if (normalized.includes(BDRC_IMPORT_SEGMENT) && milestones >= 30) return true;
  return false;
};
