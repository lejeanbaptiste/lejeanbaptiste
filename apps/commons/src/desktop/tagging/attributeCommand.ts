import {
  findDuplicateSchemaIdInDocument,
  getSchemaIdAttributeName,
  isSchemaIdAttribute,
  normalizeAttributeNameForSchema,
  validateSchemaIdValue,
} from './attributeIdHelpers';
import { isEditableAttributeName } from './reservedAttributes';

export interface ApplyAttributeResult {
  applied: boolean;
  error?: string;
}

const getWriter = () => window.writer;

export const readTagAttributes = (tagElement: Element): Record<string, string> => {
  const writer = getWriter();
  if (!writer?.tagger) return {};

  const schemaId = getSchemaIdAttributeName();
  const raw = writer.tagger.getAttributesForTag(tagElement);
  const result: Record<string, string> = {};

  for (const [name, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue;

    const canonical = normalizeAttributeNameForSchema(name);
    if (canonical === 'id') continue;
    if (!isEditableAttributeName(canonical)) continue;

    if (canonical === schemaId) {
      result[schemaId] = value;
      continue;
    }

    result[canonical] = value;
  }

  return result;
};

const sanitizeAttributesForCommit = (
  attributes: Record<string, string>,
  tagElement: Element,
): ApplyAttributeResult & { sanitized?: Record<string, string> } => {
  const schemaId = getSchemaIdAttributeName();
  const sanitized: Record<string, string> = {};

  for (const [name, value] of Object.entries(attributes)) {
    const canonical = normalizeAttributeNameForSchema(name);
    if (canonical === 'id') continue;
    if (!isEditableAttributeName(canonical)) continue;

    const trimmed = value.trim();
    if (!trimmed) continue;

    if (isSchemaIdAttribute(canonical)) {
      const formatError = validateSchemaIdValue(trimmed);
      if (formatError) return { applied: false, error: formatError };

      const duplicateTag = findDuplicateSchemaIdInDocument(trimmed, tagElement);
      if (duplicateTag) {
        return {
          applied: false,
          error: `ID "${trimmed}" is already used on another <${duplicateTag}> in this document.`,
        };
      }

      sanitized[schemaId] = trimmed;
      continue;
    }

    sanitized[canonical] = trimmed;
  }

  return { applied: true, sanitized };
};

export const commitTagAttributes = (
  tagElement: Element,
  attributes: Record<string, string>,
  tagName?: string,
): ApplyAttributeResult => {
  const writer = getWriter();
  if (!writer?.editor || !writer.tagger) {
    return { applied: false, error: 'Editor not ready' };
  }

  const { applied, error, sanitized } = sanitizeAttributesForCommit(attributes, tagElement);
  if (!applied || !sanitized) {
    return { applied: false, error };
  }

  const $tag = writer.tagger.getCurrentTag(tagElement.getAttribute('id') ?? undefined);
  if (!$tag?.length) return { applied: false, error: 'Tag not found' };

  const apply = () => {
    writer.tagger.editStructureTag(
      $tag,
      sanitized,
      tagName ?? tagElement.getAttribute('_tag') ?? undefined,
    );
  };

  if (writer.editor.undoManager?.transact) {
    writer.editor.undoManager.transact(apply);
  } else {
    apply();
  }

  writer.event('contentChanged').publish();
  writer.event('tagEdited').publish(tagElement);
  return { applied: true };
};

export const applyAttributeToTag = (
  tagElement: Element,
  attrName: string,
  attrValue: string,
): ApplyAttributeResult => {
  const canonical = normalizeAttributeNameForSchema(attrName);
  if (canonical === 'id' || !isEditableAttributeName(canonical)) {
    return { applied: false, error: `Attribute "${attrName}" cannot be edited here.` };
  }

  const current = readTagAttributes(tagElement);
  if (!attrValue.trim()) {
    delete current[canonical];
  } else {
    current[canonical] = attrValue.trim();
  }
  return commitTagAttributes(tagElement, current);
};

export const removeAttributeFromTag = (
  tagElement: Element,
  attrName: string,
): ApplyAttributeResult => {
  const canonical = normalizeAttributeNameForSchema(attrName);
  if (canonical === 'id' || !isEditableAttributeName(canonical)) {
    return { applied: false, error: `Attribute "${attrName}" cannot be removed here.` };
  }
  const current = readTagAttributes(tagElement);
  delete current[canonical];
  return commitTagAttributes(tagElement, current);
};

export const applyLookupAttributes = (
  tagElement: Element,
  attrs: Record<string, string>,
): ApplyAttributeResult => {
  const current = readTagAttributes(tagElement);
  for (const [name, value] of Object.entries(attrs)) {
    const canonical = normalizeAttributeNameForSchema(name);
    if (canonical === 'id' || !isEditableAttributeName(canonical) || !value.trim()) continue;
    current[canonical] = value.trim();
  }
  return commitTagAttributes(tagElement, current);
};
