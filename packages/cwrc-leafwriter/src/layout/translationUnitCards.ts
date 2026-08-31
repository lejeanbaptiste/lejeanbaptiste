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
  alignmentUnit: 'div' | 'p' | 'ab',
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

/** Footnotes before this unit in document order (for continuous numbering). */
export const footnoteStartIndexForUnit = (
  unitId: string,
  cards: readonly Pick<TranslationUnitCard, 'unitId' | 'noteCount'>[],
): number => {
  let sum = 0;
  for (const card of cards) {
    if (card.unitId === unitId) return sum;
    sum += card.noteCount;
  }
  return sum;
};

/** True when a unit has no visible translation text (AI may fill it). */
export const isTranslationUnitBlank = (html: string): boolean => {
  const withoutNotes = html.replace(/<note[\s\S]*?<\/note>/gi, '');
  const text = withoutNotes
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\u00a0/g, ' ')
    .trim();
  return text.length === 0;
};
