import {
  applyRegexReplacement,
  compileFindLiteralRegex,
  compileFindRegex,
} from '../utilities/regexPatternUtils';

/** Text-preserving bulk tag/attribute transformation used by Advanced Tag Transform. */
export interface PurgePredicate {
  name: string;
  value?: string;
  negated?: boolean;
  remove?: boolean;
}
export interface PurgeOptions {
  string: string;
  regex?: boolean;
  tagName: string;
  tagNegated?: boolean;
  key?: PurgePredicate;
  attributes?: PurgePredicate[];
  purgeTag?: boolean;
  purgeChildren?: boolean;
  replaceTagName?: string;
  replaceKey?: PurgePredicate;
  replaceString?: string;
  /** Optional schema gate for creating or renaming tags. */
  canInsertTag?: (tagName: string, parentName: string) => boolean;
  changes?: { name: string; value: string; remove?: boolean }[];
}

export const INFRASTRUCTURE_TAGS = new Set([
  'pb',
  'lb',
  'cb',
  'milestone',
  'anchor',
  'ptr',
  'gap',
  'teiHeader',
  'fileDesc',
  'titleStmt',
  'publicationStmt',
  'sourceDesc',
  'encodingDesc',
  'profileDesc',
  'textClass',
  'revisionDesc',
  'change',
]);

const matches = (value: string | null, predicate?: PurgePredicate, matcher?: RegExp) => {
  if (!predicate?.name.trim() || !predicate.value?.trim()) return true;
  if (matcher) matcher.lastIndex = 0;
  const result = matcher ? matcher.test(value ?? '') : value === predicate.value;
  return predicate.negated ? !result : result;
};

const stringValue = (element: Element): string =>
  Array.from(element.childNodes)
    .map((node) =>
      node.nodeType === Node.TEXT_NODE ? (node.nodeValue ?? '') : (node.textContent ?? ''),
    )
    .join('');

const unwrapChildrenExceptInfrastructure = (element: Element) => {
  for (const child of Array.from(element.children)) {
    if (!INFRASTRUCTURE_TAGS.has(child.localName))
      child.replaceWith(...Array.from(child.childNodes));
  }
};

const unwrapElement = (element: Element) => element.replaceWith(...Array.from(element.childNodes));

const wrapTextMatches = (doc: Document, options: PurgeOptions, tagName: string): number => {
  if (tagName === '*' || options.purgeTag || options.purgeChildren) return 0;
  const matcher = options.regex
    ? compileFindRegex(options.string)
    : compileFindLiteralRegex(options.string);
  let count = 0;
  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    const text = current as Text;
    if (text.parentElement && !INFRASTRUCTURE_TAGS.has(text.parentElement.localName))
      nodes.push(text);
  }
  for (const textNode of nodes) {
    const source = textNode.nodeValue ?? '';
    matcher.lastIndex = 0;
    const matchesInText = Array.from(source.matchAll(matcher));
    if (
      !matchesInText.length ||
      !matches(
        options.key ? (textNode.parentElement?.getAttribute(options.key.name) ?? null) : null,
        options.key,
      )
    )
      continue;
    if (
      options.canInsertTag &&
      textNode.parentElement &&
      !options.canInsertTag(tagName, textNode.parentElement.localName)
    )
      continue;
    const fragment = doc.createDocumentFragment();
    let offset = 0;
    for (const match of matchesInText) {
      const before = source.slice(offset, match.index);
      if (before) fragment.appendChild(doc.createTextNode(before));
      const replacement = doc.createElement(tagName);
      replacement.textContent =
        options.regex && options.replaceString !== undefined
          ? applyRegexReplacement(match, options.replaceString)
          : match[0];
      for (const change of options.changes ?? []) {
        if (change.name.trim() && !change.remove)
          replacement.setAttribute(
            change.name.trim(),
            options.regex ? applyRegexReplacement(match, change.value) : change.value,
          );
      }
      if (options.replaceKey?.name.trim()) {
        if (options.replaceKey.remove) replacement.removeAttribute(options.replaceKey.name);
        else
          replacement.setAttribute(
            options.replaceKey.name,
            options.regex
              ? applyRegexReplacement(match, options.replaceKey.value ?? '')
              : (options.replaceKey.value ?? ''),
          );
      }
      fragment.appendChild(replacement);
      offset = (match.index ?? 0) + match[0].length;
      count++;
    }
    const after = source.slice(offset);
    if (after) fragment.appendChild(doc.createTextNode(after));
    textNode.replaceWith(fragment);
  }
  return count;
};

/** Applies changes without deleting text. Returns the number of matching elements. */
export const applyPurge = (doc: Document, options: PurgeOptions): number => {
  const tag = options.tagName.trim();
  const target = options.string;
  if (!tag || !target) return 0;
  if (tag === '*' && !options.tagNegated)
    return wrapTextMatches(doc, options, options.replaceTagName ?? '*');
  let count = 0;
  const elements = Array.from(
    doc.getElementsByTagName(tag === '*' || options.tagNegated ? '*' : tag),
  );
  let stringMatcher: RegExp | null = null;
  if (options.regex) {
    try {
      stringMatcher = compileFindRegex(options.string);
    } catch {
      return 0;
    }
  }
  const literalMatcher = !options.regex ? compileFindLiteralRegex(options.string) : null;
  for (const element of elements) {
    if (
      (tag !== '*' && !options.tagNegated && element.localName !== tag) ||
      (options.tagNegated && element.localName === tag) ||
      INFRASTRUCTURE_TAGS.has(element.localName)
    )
      continue;
    const value = stringValue(element);
    const match = stringMatcher ?? literalMatcher;
    if (match) match.lastIndex = 0;
    const stringMatch = match?.exec(value);
    if (
      !stringMatch ||
      (!options.regex && stringMatch[0] !== value) ||
      !matches(element.getAttribute(options.key?.name ?? ''), options.key)
    )
      continue;
    if (
      (options.attributes ?? []).some(
        (predicate) => !matches(element.getAttribute(predicate.name), predicate),
      )
    )
      continue;
    count++;
    if (options.purgeChildren) unwrapChildrenExceptInfrastructure(element);
    for (const change of options.changes ?? []) {
      if (!change.name.trim()) continue;
      if (change.remove) element.removeAttribute(change.name.trim());
      else
        element.setAttribute(
          change.name.trim(),
          options.regex && stringMatch
            ? applyRegexReplacement(stringMatch, change.value)
            : change.value,
        );
    }
    if (options.replaceKey?.name.trim()) {
      if (options.replaceKey.remove) element.removeAttribute(options.replaceKey.name);
      else
        element.setAttribute(
          options.replaceKey.name,
          options.regex && stringMatch
            ? applyRegexReplacement(stringMatch, options.replaceKey.value ?? '')
            : (options.replaceKey.value ?? ''),
        );
    }
    const replacementTag = options.replaceTagName?.trim();
    if (replacementTag === '*') {
      unwrapElement(element);
      continue;
    }
    if (replacementTag && replacementTag !== element.localName) {
      if (
        options.canInsertTag &&
        element.parentElement &&
        !options.canInsertTag(replacementTag, element.parentElement.localName)
      )
        continue;
      const replacement = doc.createElement(replacementTag);
      for (const attr of Array.from(element.attributes))
        replacement.setAttribute(attr.name, attr.value);
      while (element.firstChild) replacement.appendChild(element.firstChild);
      element.replaceWith(replacement);
      continue;
    }
    if (options.purgeTag) {
      element.replaceWith(...Array.from(element.childNodes));
    }
  }
  return count;
};
