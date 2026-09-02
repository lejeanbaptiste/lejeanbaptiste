/** Shared TEI/XML helpers for mention collection and blinding. */

export const TAG_TO_KIND: Record<string, string> = {
  persName: 'person',
  placeName: 'place',
  orgName: 'org',
  title: 'work',
  bibl: 'work',
  roleName: 'office',
  officeName: 'office',
};

export const SOURCE_UNIT_ENTITY_TAGS = Object.keys(TAG_TO_KIND);

const TEI_NS = 'http://www.tei-c.org/ns/1.0';

export const elementsByLocalName = (root: Document | Element, localName: string): Element[] => {
  const namespaced =
    'getElementsByTagNameNS' in root
      ? Array.from(root.getElementsByTagNameNS(TEI_NS, localName))
      : [];
  const plain = Array.from(root.getElementsByTagName(localName));
  const seen = new Set<Element>();
  const result: Element[] = [];
  for (const el of [...namespaced, ...plain]) {
    if (!seen.has(el)) {
      seen.add(el);
      result.push(el);
    }
  }
  return result;
};

export const normalizeSurface = (raw: string): string => raw.replace(/\s+/g, ' ').trim();
