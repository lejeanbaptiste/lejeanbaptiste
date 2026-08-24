import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export type RelaxNgIncludeResolver = (href: string) => string | null;

const isElement = (node: Node): node is Element => node.nodeType === 1;

const directChildElements = (parent: Element): Element[] =>
  Array.from(parent.childNodes).filter(isElement);

const findDirectChild = (parent: Element, tagName: string): Element | null =>
  directChildElements(parent).find((el) => el.tagName.toLowerCase() === tagName.toLowerCase()) ??
  null;

const findDirectDefine = (parent: Element, name: string): Element | null =>
  directChildElements(parent).find(
    (el) => el.tagName.toLowerCase() === 'define' && el.getAttribute('name') === name,
  ) ?? null;

/** Apply RelaxNG's `combine="choice"` to a flattened duplicate define. */
const mergeChoiceDefine = (existing: Element, incoming: Element): void => {
  const incomingChildren = directChildElements(incoming);
  let choice = directChildElements(existing).find((el) => el.tagName.toLowerCase() === 'choice');

  if (!choice) {
    choice = existing.ownerDocument!.createElement('choice');
    const priorChildren = directChildElements(existing);
    for (const child of priorChildren) choice.appendChild(child.cloneNode(true));
    for (const child of priorChildren) existing.removeChild(child);
    existing.appendChild(choice);
  }

  for (const child of incomingChildren) {
    choice.appendChild(existing.ownerDocument!.importNode(child, true));
  }
  existing.removeAttribute('combine');
};

const mergeDefine = (parent: Element, incoming: Element): void => {
  const name = incoming.getAttribute('name');
  const existing = name ? findDirectDefine(parent, name) : null;
  if (existing && incoming.getAttribute('combine') === 'choice') {
    mergeChoiceDefine(existing, incoming);
    return;
  }

  const clone = incoming.ownerDocument!.importNode(incoming, true);
  if (existing) existing.parentNode!.replaceChild(clone, existing);
  else parent.appendChild(clone);
};

const mergeChildIntoGrammar = (targetGrammar: Element, child: Element): void => {
  const tag = child.tagName.toLowerCase();
  if (tag === 'start') {
    const existing = findDirectChild(targetGrammar, 'start');
    const clone = child.cloneNode(true);
    if (existing) existing.parentNode!.replaceChild(clone, existing);
    else targetGrammar.appendChild(clone);
    return;
  }
  if (tag === 'define') {
    mergeDefine(targetGrammar, child);
  }
};

const flattenGrammarIncludes = (
  grammar: Element,
  resolveInclude: RelaxNgIncludeResolver,
  parser: DOMParser,
): void => {
  const includes = directChildElements(grammar).filter(
    (el) => el.tagName.toLowerCase() === 'include',
  );

  for (const includeEl of includes) {
    const href = includeEl.getAttribute('href');
    if (!href) continue;

    const includeText = resolveInclude(href);
    if (!includeText) {
      throw new Error(`Could not resolve RelaxNG include: ${href}`);
    }

    const includeDoc = parser.parseFromString(includeText, 'application/xml');
    if (includeDoc.getElementsByTagName('parsererror').length) {
      throw new Error(`Invalid RelaxNG in include ${href}`);
    }

    const includeGrammar = includeDoc.documentElement;
    if (!includeGrammar || includeGrammar.tagName.toLowerCase() !== 'grammar') {
      throw new Error(`Included RelaxNG has no grammar root: ${href}`);
    }

    flattenGrammarIncludes(includeGrammar, resolveInclude, parser);

    for (const overrideChild of directChildElements(includeEl)) {
      const tag = overrideChild.tagName.toLowerCase();
      if (tag === 'start') {
        const existingStart = findDirectChild(includeGrammar, 'start');
        const imported = includeDoc.importNode(overrideChild, true);
        if (existingStart) existingStart.parentNode!.replaceChild(imported, existingStart);
        else includeGrammar.appendChild(imported);
      } else if (tag === 'define') {
        mergeDefine(includeGrammar, overrideChild);
      }
    }

    for (const child of directChildElements(includeGrammar)) {
      mergeChildIntoGrammar(grammar, child);
    }

    includeEl.parentNode!.removeChild(includeEl);
  }
};

/**
 * Resolve every top-level `<include>` into a single self-contained grammar.
 * Mirrors the in-app merge used by the validator worker, but runs once at
 * schema install / sanmiao merge time so runtime code paths share one artifact.
 */
export const flattenRelaxNgGrammar = (
  rngText: string,
  resolveInclude: RelaxNgIncludeResolver,
): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rngText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('Invalid RelaxNG XML');
  }

  const grammar = doc.documentElement;
  if (!grammar || grammar.tagName.toLowerCase() !== 'grammar') {
    throw new Error('RelaxNG document must have a grammar root');
  }

  flattenGrammarIncludes(grammar, resolveInclude, parser);
  return new XMLSerializer().serializeToString(doc);
};
