import tagDefinitions from './prompt-templates/tag-definitions.json';
import { DEFAULT_CRAWL_TAGS } from './crawl';

const TAG_DEFINITION_KEYS = Object.keys(tagDefinitions);

export const DEFAULT_AI_TAG_SELECTION = ['persName', 'placeName'];

interface SchemaMapperLike {
  getEntitiesMapping?: () => Map<string, { parentTag?: string | string[] }>;
}

interface WriterLike {
  schemaManager?: { mapper?: SchemaMapperLike };
}

function parentTagsFromSchema(mapper?: SchemaMapperLike): string[] {
  const entities = mapper?.getEntitiesMapping?.();
  if (!entities) return [];
  const tags = new Set<string>();
  for (const mapping of entities.values()) {
    const parent = mapping.parentTag;
    if (typeof parent === 'string' && parent.trim()) tags.add(parent.trim());
    else if (Array.isArray(parent)) {
      for (const item of parent) {
        if (typeof item === 'string' && item.trim()) tags.add(item.trim());
      }
    }
  }
  return [...tags];
}

/** Tag names offered in the AI suggest/audit picker — schema tags plus crawl/definition defaults. */
export function listAiTagOptions(writer?: WriterLike | null): string[] {
  const fromSchema = parentTagsFromSchema(writer?.schemaManager?.mapper);
  const merged = new Set([...fromSchema, ...TAG_DEFINITION_KEYS, ...DEFAULT_CRAWL_TAGS]);
  return [...merged].sort((a, b) => a.localeCompare(b));
}

/** Default chip selection — prefer persName/placeName when the schema exposes them. */
export function defaultAiTagSelection(available: string[]): string[] {
  const availableSet = new Set(available);
  const preferred = DEFAULT_AI_TAG_SELECTION.filter((tag) => availableSet.has(tag));
  return preferred.length > 0 ? preferred : available.slice(0, 2);
}
