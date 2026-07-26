/** Text-preserving bulk tag/attribute transformation used by the Purge tool. */
export interface PurgePredicate { name: string; value?: string; negated?: boolean }
export interface PurgeOptions {
  string: string;
  tagName: string;
  key?: PurgePredicate;
  attributes?: PurgePredicate[];
  purgeTag?: boolean;
  purgeChildren?: boolean;
  changes?: Array<{ name: string; value: string }>;
}

const INFRASTRUCTURE_TAGS = new Set(['pb', 'lb', 'cb', 'milestone', 'anchor', 'ptr', 'gap']);

const matches = (value: string | null, predicate?: PurgePredicate) => {
  if (!predicate?.name.trim() || !predicate.value?.trim()) return true;
  const result = value === predicate.value;
  return predicate.negated ? !result : result;
};

const hasProtectedDescendant = (element: Element) =>
  Array.from(element.querySelectorAll('*')).some((child) => INFRASTRUCTURE_TAGS.has(child.localName));

/** Applies changes without deleting text. Returns the number of matching elements. */
export const applyPurge = (doc: Document, options: PurgeOptions): number => {
  const tag = options.tagName.trim();
  const target = options.string;
  if (!tag || !target) return 0;
  let count = 0;
  const elements = Array.from(doc.getElementsByTagName(tag));
  for (const element of elements) {
    if (element.localName !== tag || INFRASTRUCTURE_TAGS.has(element.localName)) continue;
    const stringValue = Array.from(element.childNodes).reduce(
      (text, node) => text + (node.nodeType === Node.TEXT_NODE ? node.nodeValue ?? '' : node.textContent ?? ''),
      '',
    );
    if (stringValue !== target || !matches(element.getAttribute(options.key?.name ?? ''), options.key)) continue;
    if ((options.attributes ?? []).some((predicate) => !matches(element.getAttribute(predicate.name), predicate))) continue;
    if (hasProtectedDescendant(element)) continue;
    count++;
    if (options.purgeChildren) {
      for (const child of Array.from(element.children)) {
        if (!INFRASTRUCTURE_TAGS.has(child.localName)) child.replaceWith(...Array.from(child.childNodes));
      }
    }
    for (const change of options.changes ?? []) {
      if (change.name.trim()) element.setAttribute(change.name.trim(), change.value);
    }
    if (options.purgeTag) {
      element.replaceWith(...Array.from(element.childNodes));
    }
  }
  return count;
};
