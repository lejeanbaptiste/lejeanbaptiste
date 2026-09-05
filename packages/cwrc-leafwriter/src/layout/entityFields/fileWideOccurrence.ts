/**
 * File-wide entity occurrence counting across a companion translation document.
 */

import { ENTITY_REF_TYPE } from './translationEntityFields';
import { collectTranslationUnitCards } from '../translationUnitCards';

export interface FileEntityFieldRef {
  unitId: string;
  field: Element;
  entityKey: string;
}

/** All grognard-entity fields in companion document order. */
export const collectEntityFieldsInDocumentOrder = (
  doc: Document,
  alignmentUnit: 'div' | 'p' | 'ab',
  sourceFileName: string,
): FileEntityFieldRef[] => {
  const cards = collectTranslationUnitCards(doc, alignmentUnit, sourceFileName);
  const prefix = `${sourceFileName}#`;
  const result: FileEntityFieldRef[] = [];

  for (const card of cards) {
    const unitEl = [...doc.getElementsByTagName(alignmentUnit)].find(
      (el) => el.getAttribute('corresp') === `${prefix}${card.unitId}`,
    );
    if (!unitEl) continue;
    const fields = unitEl.querySelectorAll(`ref[type="${ENTITY_REF_TYPE}"][key]`);
    for (const field of Array.from(fields)) {
      const entityKey = field.getAttribute('key');
      if (!entityKey) continue;
      result.push({ unitId: card.unitId, field, entityKey });
    }
  }

  return result;
};

/** Count same-key entity refs in units before `unitId` plus index within unit. */
export const fileOccurrenceIndexForUnitInsert = (
  doc: Document | null,
  alignmentUnit: 'div' | 'p' | 'ab',
  sourceFileName: string,
  unitId: string,
  entityKey: string,
  withinUnitExisting = 0,
): number => {
  if (!doc) return withinUnitExisting + 1;
  const ordered = collectEntityFieldsInDocumentOrder(doc, alignmentUnit, sourceFileName);
  let count = 0;
  for (const ref of ordered) {
    if (ref.unitId === unitId && ref.entityKey === entityKey) {
      return count + withinUnitExisting + 1;
    }
    if (ref.entityKey === entityKey) count += 1;
  }
  return withinUnitExisting + 1;
};

export const countPriorEntityRefsInDocument = (
  doc: Document | null,
  alignmentUnit: 'div' | 'p' | 'ab',
  sourceFileName: string,
  beforeUnitId: string,
  entityKey: string,
): number => {
  if (!doc) return 0;
  const ordered = collectEntityFieldsInDocumentOrder(doc, alignmentUnit, sourceFileName);
  let count = 0;
  for (const ref of ordered) {
    if (ref.unitId === beforeUnitId) break;
    if (ref.entityKey === entityKey) count += 1;
  }
  return count;
};
