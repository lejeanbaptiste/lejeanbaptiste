import { entityLookupDialogAtom, Types } from '@cwrc/leafwriter';
import { getDefaultStore } from 'jotai';
import { RESET } from 'jotai/utils';
import { applyLookupAttributes } from './attributeCommand';

const { namedEntityTypesSchema } = Types;
type EntityLink = Types.EntityLink;

const getWriter = () => window.writer;

export const getLookupEntityTypeForTag = (tagName: string): string | null => {
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
      if (response?.properties?.uri) {
        applyLookupAttributes(tagElement, {
          ref: response.properties.uri,
          key: response.properties.lemma || response.name,
        });
        onApplied?.();
      }
    },
  });

  return true;
};
