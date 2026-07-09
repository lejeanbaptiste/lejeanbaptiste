import { entityLookupDialogAtom, Types } from '@cwrc/leafwriter';
import { getDefaultStore } from 'jotai';
import { RESET } from 'jotai/utils';
import { commitTagAttributes, readTagAttributes } from './attributeCommand';

const { namedEntityTypesSchema } = Types;
type NamedEntityType = Types.NamedEntityType;
type EntityLink = Types.EntityLink;

const getWriter = () => window.writer;

export const getLookupEntityTypeForTag = (tagName: string): NamedEntityType | null => {
  const writer = getWriter();
  if (!writer?.schemaManager?.mapper) return null;
  const type = writer.schemaManager.mapper.getEntityTypeForTag(tagName);
  if (!type) return null;
  const parsed = namedEntityTypesSchema.safeParse(type);
  return parsed.success ? parsed.data : null;
};

export const openEntityLookupForTag = (
  tagElement: Element,
  onApplied?: () => void,
): boolean => {
  const writer = getWriter();
  if (!writer) return false;

  const tagName = tagElement.getAttribute('_tag') ?? '';
  const entityType = getLookupEntityTypeForTag(tagName);
  if (!entityType) return false;

  const query = tagElement.textContent?.trim() ?? '';
  const store = getDefaultStore();

  store.set(entityLookupDialogAtom, {
    isUserAuthenticated: writer.overmindState?.user?.uri !== '#anonymous',
    query,
    type: entityType,
    onClose: (response?: EntityLink) => {
      store.set(entityLookupDialogAtom, RESET);
      if (response?.key) {
        const nextAttributes = readTagAttributes(tagElement);
        delete nextAttributes.ref;
        nextAttributes.key = String(response.key);
        commitTagAttributes(tagElement, nextAttributes);
        onApplied?.();
      }
    },
  });

  return true;
};
