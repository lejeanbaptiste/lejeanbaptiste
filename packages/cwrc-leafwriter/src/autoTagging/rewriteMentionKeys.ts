/**
 * Rewrite mention `@key` attributes in raw XML text after an entity merge or
 * delete. Works on the serialized string — never a DOM round-trip — so the
 * user's file formatting, entity references, and encoding survive untouched.
 *
 * A remap value of `null` strips the attribute (deleted entity); a string
 * replaces the key (merged entity).
 */

export interface RewriteResult {
  xml: string;
  /** Number of key attributes rewritten or stripped. */
  count: number;
  changed: boolean;
}

/** Comments and CDATA sections are opaque: never rewrite inside them. */
const OPAQUE_SECTION = /(<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>)/g;

/** Matches an element open tag (not comments, PIs, CDATA, or closing tags). */
const OPEN_TAG = /<[A-Za-z_][^<>]*>/g;

/** Matches a key attribute inside a tag: key="…" or key='…'. */
const KEY_ATTR = /(\s+)key=(["'])([^"']*)\2/g;

export function rewriteMentionKeys(
  xml: string,
  remap: Record<string, string | null>,
): RewriteResult {
  let count = 0;

  const rewriteSegment = (segment: string) =>
    segment.replace(OPEN_TAG, (tag) => {
      if (!tag.includes('key=')) return tag;
      return tag.replace(KEY_ATTR, (attr, space: string, quote: string, value: string) => {
        if (!(value in remap)) return attr;
        count += 1;
        const next = remap[value];
        if (next === null) return '';
        return `${space}key=${quote}${next}${quote}`;
      });
    });

  const rewritten = xml
    .split(OPAQUE_SECTION)
    .map((part, index) => (index % 2 === 1 ? part : rewriteSegment(part)))
    .join('');

  return { xml: rewritten, count, changed: count > 0 };
}

/** True when the raw XML contains any of the given keys (cheap pre-filter). */
export function containsAnyKey(xml: string, keys: string[]): boolean {
  return keys.some((key) => xml.includes(`key="${key}"`) || xml.includes(`key='${key}'`));
}

/**
 * Collect every mention `@key` value in the raw XML (open tags only, skipping
 * comments/CDATA), string-based to match `rewriteMentionKeys`. Used by the
 * orphan sweep to compare corpus keys against the entity database.
 */
export function collectKeys(xml: string): Set<string> {
  const keys = new Set<string>();
  const segments = xml.split(OPAQUE_SECTION);
  for (let i = 0; i < segments.length; i += 1) {
    if (i % 2 === 1) continue; // opaque section
    const tags = segments[i]!.match(OPEN_TAG);
    if (!tags) continue;
    for (const tag of tags) {
      if (!tag.includes('key=')) continue;
      let match: RegExpExecArray | null;
      KEY_ATTR.lastIndex = 0;
      while ((match = KEY_ATTR.exec(tag)) !== null) {
        if (match[3]) keys.add(match[3]);
      }
    }
  }
  return keys;
}
