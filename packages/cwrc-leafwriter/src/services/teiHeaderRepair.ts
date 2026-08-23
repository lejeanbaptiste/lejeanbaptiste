const RNG_NS = 'http://relaxng.org/ns/structure/1.0';
const TEI_NS = 'http://www.tei-c.org/ns/1.0';

export interface HeaderRepair {
  repairedXml: string;
  schemaOrder: string[];
  beforeOrder: string[];
  afterOrder: string[];
  description: string;
}

const childElements = (node: Element): Element[] =>
  Array.from(node.children).filter((child): child is Element => child instanceof Element);

const findDefine = (schema: Document, name: string): Element | null =>
  Array.from(schema.getElementsByTagNameNS(RNG_NS, 'define')).find(
    (define) => define.getAttribute('name') === name,
  ) ?? null;

/** Read the direct teiHeader sequence from the active Relax NG grammar. */
export const readTeiHeaderOrder = (schemaText: string): string[] | null => {
  const schema = new DOMParser().parseFromString(schemaText, 'application/xml');
  if (schema.querySelector('parsererror')) return null;

  const define = findDefine(schema, 'teiHeader');
  const headerElement = define
    ? childElements(define).find(
        (child) => child.localName === 'element' && child.getAttribute('name') === 'teiHeader',
      )
    : null;
  const group = headerElement
    ? childElements(headerElement).find((child) => child.localName === 'group')
    : null;
  const headerPart = findDefine(schema, 'model.teiHeaderPart');
  const choice = headerPart
    ? childElements(headerPart).find((child) => child.localName === 'choice')
    : null;
  if (!group || !choice) return null;

  const modelNames = childElements(choice)
    .filter((child) => child.localName === 'ref')
    .map((child) => child.getAttribute('name'))
    .filter((name): name is string => Boolean(name));

  const result: string[] = [];
  const read = (node: Element): boolean => {
    if (node.localName === 'ref') {
      const name = node.getAttribute('name');
      if (!name) return false;
      if (name === 'model.teiHeaderPart') result.push(...modelNames);
      else result.push(name);
      return true;
    }
    if (!['optional', 'zeroOrMore', 'oneOrMore', 'group'].includes(node.localName)) return false;
    return childElements(node).every(read);
  };

  return childElements(group).every(read) ? result : null;
};

const headerFor = (document: Document): Element | null =>
  document.getElementsByTagNameNS(TEI_NS, 'teiHeader')[0] ?? document.querySelector('teiHeader');

/**
 * Apply only a schema-derived direct-child reorder to teiHeader. Unknown
 * children or non-whitespace direct text make the rule inapplicable.
 */
export const repairTeiHeader = (xml: string, schemaText: string): HeaderRepair | null => {
  const order = readTeiHeaderOrder(schemaText);
  if (!order) return null;

  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) return null;
  const header = headerFor(document);
  if (!header) return null;

  const elements = childElements(header);
  const names = elements.map((element) => element.localName);
  const rank = new Map(order.map((name, index) => [name, index]));
  if (names.some((name) => !rank.has(name))) return null;
  if (
    Array.from(header.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
    )
  ) {
    return null;
  }

  const sorted = elements
    .map((element, index) => ({ element, index }))
    .sort(
      (a, b) =>
        rank.get(a.element.localName)! - rank.get(b.element.localName)! || a.index - b.index,
    )
    .map(({ element }) => element);
  const afterOrder = sorted.map((element) => element.localName);
  if (names.every((name, index) => name === afterOrder[index])) return null;

  while (header.firstChild) header.removeChild(header.firstChild);
  sorted.forEach((element, index) => {
    header.appendChild(document.createTextNode('\n    '));
    header.appendChild(element);
    if (index === sorted.length - 1) header.appendChild(document.createTextNode('\n  '));
  });

  return {
    repairedXml: new XMLSerializer().serializeToString(document),
    schemaOrder: order,
    beforeOrder: names,
    afterOrder,
    description: `Reorder teiHeader children: ${names.join(', ')} → ${afterOrder.join(', ')}`,
  };
};
