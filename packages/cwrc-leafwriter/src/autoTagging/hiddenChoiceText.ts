/**
 * `<sic>` (the as-written, often erroneous half of a `<choice>`) and
 * `<surplus>` (letters present in the source but not meant to be read) hold
 * text that is not part of the intended reading. `.textContent` and
 * `XMLSerializer` flatten them in anyway, alongside `<corr>` — so any
 * string-based consumer (disambiguation surface matching, sanmiao date
 * resolve) that reads a raw string ends up seeing both halves of the choice
 * concatenated, corrupting the string it forwards.
 */
const HIDDEN_READING_LOCAL_NAMES = new Set(['sic', 'surplus']);

/**
 * Deep-clone `element` with the text of every `<sic>`/`<surplus>` descendant
 * cleared, so `.textContent` / `XMLSerializer` on the clone reflects only the
 * intended reading (e.g. `<corr>`) instead of concatenating both `<choice>`
 * branches.
 */
export function cloneWithHiddenReadingsCleared(element: Element): Element {
  const clone = element.cloneNode(true) as Element;
  const doc = clone.ownerDocument;
  if (!doc) return clone;
  const walker = doc.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
  const toClear: Element[] = [];
  let node = walker.nextNode();
  while (node) {
    const el = node as Element;
    if (HIDDEN_READING_LOCAL_NAMES.has(el.localName)) toClear.push(el);
    node = walker.nextNode();
  }
  for (const el of toClear) el.textContent = '';
  return clone;
}

/** `element`'s text content with `<sic>`/`<surplus>` readings excluded. */
export function textWithoutHiddenReadings(element: Element): string {
  return cloneWithHiddenReadingsCleared(element).textContent ?? '';
}
