/** Count TEI page/line milestones that explode the visual editor node tree. */
export const countTeiMilestones = (xml: string): number => {
  if (!xml) return 0;
  const matches = xml.match(/<(lb|pb)\b/gi);
  return matches?.length ?? 0;
};

const BDRC_IMPORT_SEGMENT = '/imported/bdrc/';

/**
 * Large BDRC volumes carry a `<pb/>` per folio and `<lb/>` per line. The visual
 * editor walks every node when building TinyMCE markup and can run out of memory.
 * Prefer Source mode for those documents (import, reopen, and tab restore).
 */
export const shouldOpenTeiInSourceMode = (xml: string, filePath?: string): boolean => {
  const milestones = countTeiMilestones(xml);
  if (milestones >= 100) return true;
  if (xml.length >= 500_000 && milestones >= 20) return true;
  const normalized = filePath?.replace(/\\/g, '/').toLowerCase() ?? '';
  if (normalized.includes(BDRC_IMPORT_SEGMENT) && milestones >= 30) return true;
  return false;
};
