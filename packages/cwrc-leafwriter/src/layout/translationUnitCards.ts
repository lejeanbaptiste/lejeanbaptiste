const TEI_NS = 'http://www.tei-c.org/ns/1.0';

const getElementsByLocalName = (root: Document | Element, localName: string): Element[] => {
  const namespaced = Array.from(root.getElementsByTagNameNS(TEI_NS, localName));
  const plain = Array.from(root.getElementsByTagName(localName));
  const seen = new Set<Element>();
  const result: Element[] = [];
  for (const element of [...namespaced, ...plain]) {
    if (!seen.has(element)) {
      seen.add(element);
      result.push(element);
    }
  }
  return result;
};

export interface TranslationUnitCard {
  unitId: string;
  previewText: string;
  /** Unit innerHTML for always-open read-only cards (active unit uses the live editor instead). */
  previewHtml: string;
  noteCount: number;
}

/** Companion alignment units for the open source file, in document order. */
export const collectTranslationUnitCards = (
  doc: Document,
  alignmentUnit: 'div' | 'p',
  sourceFileName: string,
): TranslationUnitCard[] => {
  const prefix = `${sourceFileName}#`;
  return getElementsByLocalName(doc, alignmentUnit)
    .filter((element) => (element.getAttribute('corresp') ?? '').startsWith(prefix))
    .map((element) => {
      const corresp = element.getAttribute('corresp') ?? '';
      const unitId = corresp.slice(prefix.length);
      const noteCount = element.getElementsByTagName('note').length;
      const previewText = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
      return { unitId, previewText, previewHtml: element.innerHTML, noteCount };
    })
    .filter((card) => card.unitId.length > 0);
};
