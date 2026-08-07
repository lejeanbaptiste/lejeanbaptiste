/**
 * Remove redundant temporal prepositions the model adds before a date
 * placeholder / field — LJBtero glosses already begin with On/In (En/Le…).
 *
 *   "In {{date:0}}" → "{{date:0}}"
 *   "On On year 3…" is avoided because the source is blinded to {{date:N}}.
 */

const PREPOSITIONS =
  'In|On|En|Dans|Le|La|Les|Au|Aux|À|A|Dès|Des|Du|De|The';

/** Strip "In "/"On "/… immediately before `{{date:N}}` in AI plain text. */
export const stripLeadingDatePrepositionsFromText = (text: string): string => {
  if (!text.includes('{{date:')) return text;
  const re = new RegExp(
    `(^|[\\s\\(\\[\\{«"“'])(?:${PREPOSITIONS})\\s+(?=\\{\\{date:\\d+\\}\\})`,
    'gi',
  );
  return text.replace(re, '$1');
};

/**
 * After date fields are substituted, also clear a preposition in the text node
 * immediately preceding each `ref[type="ljb-date"]`.
 */
export const stripLeadingDatePrepositionsBeforeDateFields = (root: ParentNode): void => {
  const fields = Array.from(
    (root as ParentNode & { querySelectorAll: typeof Element.prototype.querySelectorAll }).querySelectorAll?.(
      'ref[type="ljb-date"]',
    ) ?? [],
  );
  const prepositionOnly = new RegExp(`^(.*?)\\b(?:${PREPOSITIONS})\\s*$`, 'i');

  for (const field of fields) {
    const prev = field.previousSibling;
    if (!prev || prev.nodeType !== Node.TEXT_NODE) continue;
    const text = prev.textContent ?? '';
    const match = text.match(prepositionOnly);
    if (!match) continue;
    const kept = match[1] ?? '';
    // Only strip when the preposition is the last word (possibly after punctuation/space).
    if (kept === text) continue;
    prev.textContent = kept;
  }
};
