import { TAG_TO_ENTITY_TYPE } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/disambiguationCandidates';
import type { NamedEntityType } from '../../../../../packages/cwrc-leafwriter/src/types';

const LOOKUP_TYPES = new Set<string>([
  'person',
  'place',
  'organization',
  'work',
  'office',
  'thing',
  'concept',
  'citation',
]);

/**
 * Resolve the entity-lookup dialog type for a TEI tag.
 * Prefer the shared tag map (includes roleName → office); optionally fall back
 * to a schema-mapper type string when provided.
 */
export function resolveLookupEntityTypeForTag(
  tagName: string,
  mapperType?: string | null,
): NamedEntityType | null {
  const trimmed = tagName.trim();
  if (!trimmed) return null;

  const fromTagMap = TAG_TO_ENTITY_TYPE[trimmed];
  if (fromTagMap) return fromTagMap;

  if (mapperType && LOOKUP_TYPES.has(mapperType)) return mapperType as NamedEntityType;
  return null;
}
