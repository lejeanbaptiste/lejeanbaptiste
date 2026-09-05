import { entityLookupDialogAtom } from '@cwrc/leafwriter';
import { getDefaultStore } from 'jotai';
import { RESET } from 'jotai/utils';
import { entityStoreFromDesktop } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import type {
  EntityLink,
  NamedEntityType,
} from '../../../../../packages/cwrc-leafwriter/src/types';
import { commitTagAttributes, readTagAttributes } from './attributeCommand';
import { resolveLookupEntityTypeForTag } from './attributeLookupTypes';

const getWriter = () => window.writer;

/**
 * Which entity-lookup dialog to open for a TEI tag in the Attributes panel.
 * Prefer the explicit tag map (includes roleName → office); fall back to the
 * schema mapper for schema-specific entity tags.
 */
export const getLookupEntityTypeForTag = (tagName: string): NamedEntityType | null => {
  const writer = getWriter();
  const mapperType = writer?.schemaManager?.mapper
    ? writer.schemaManager.mapper.getEntityTypeForTag(tagName)
    : null;
  return resolveLookupEntityTypeForTag(tagName, mapperType);
};

export const openEntityLookupForTag = (tagElement: Element, onApplied?: () => void): boolean => {
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
        // Capture the mention's own @type (a user-defined thing sub-type,
        // e.g. "medicinal_plant") onto the newly minted/linked entity — the
        // lookup dialog itself only knows the coarse "thing" kind, never the
        // specific sub-type, so this is the one place both the tag's @type
        // and the freshly-resolved entity id are in scope together.
        if (tagName === 'rs' && nextAttributes.type) {
          entityStoreFromDesktop()
            ?.sqliteUpdateSubtype(String(response.key), nextAttributes.type)
            .catch(() => {
              // Non-fatal: the entity is already minted/linked at this point;
              // losing the subtype capture shouldn't surface as a tagging error.
            });
        }
        onApplied?.();
      }
    },
  });

  return true;
};
