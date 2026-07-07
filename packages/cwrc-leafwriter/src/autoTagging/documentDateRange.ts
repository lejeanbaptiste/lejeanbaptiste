/** Parse the leading CE year from a TEI `@when`-style value (e.g. `405-03-01`, `618`, `-0050`). */
export function parseTeiYear(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(-?\d{1,4})/);
  if (!match) return null;
  const year = parseInt(match[1]!, 10);
  return Number.isFinite(year) ? year : null;
}

const DATE_YEAR_ATTRS = ['when', 'from', 'to', 'notBefore', 'notAfter'] as const;

/**
 * Min/max CE years from resolved `<date>` attributes in the document.
 * Uses `@when`, `@from`, `@to`, `@notBefore`, `@notAfter` when present.
 */
export function extractDocumentDateRange(doc: Document): { start: number; end: number } | null {
  const years: number[] = [];
  const dates = doc.getElementsByTagName('date');

  for (let i = 0; i < dates.length; i++) {
    const el = dates.item(i)!;
    for (const attr of DATE_YEAR_ATTRS) {
      const year = parseTeiYear(el.getAttribute(attr) ?? '');
      if (year != null) years.push(year);
    }
  }

  if (years.length === 0) return null;
  return { start: Math.min(...years), end: Math.max(...years) };
}
