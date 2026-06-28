/** TEI / LEAF-Writer xml:id rules — ASCII NCName subset for client-side checks. */
export const SCHEMA_ID_VALUE_PATTERN = /^[A-Za-z_][\w.-]*$/;

const getWriter = () => window.writer;

export const getSchemaIdAttributeName = (): string =>
  getWriter()?.schemaManager?.getIdName?.() ?? 'xml:id';

export const isSchemaIdAttribute = (name: string): boolean =>
  normalizeAttributeNameForSchema(name) === getSchemaIdAttributeName();

export const normalizeAttributeNameForSchema = (name: string): string => {
  const trimmed = name.trim();
  const schemaId = getSchemaIdAttributeName();
  if (trimmed === 'id' || trimmed === schemaId || trimmed === 'xml:id') {
    return schemaId;
  }
  return trimmed;
};

export const validateSchemaIdValue = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'ID values cannot be empty.';
  }
  if (!SCHEMA_ID_VALUE_PATTERN.test(trimmed)) {
    return 'IDs must start with a letter or underscore and use only letters, digits, hyphens, underscores, or periods.';
  }
  return undefined;
};

export const findDuplicateSchemaIdInDocument = (
  idValue: string,
  excludeElement?: Element | null,
): string | undefined => {
  const writer = getWriter();
  const body = writer?.editor?.getBody();
  if (!body || !writer?.tagger) return undefined;

  const schemaId = getSchemaIdAttributeName();
  const normalized = idValue.trim();
  const tagged = body.querySelectorAll('[_tag]');

  for (const tag of tagged) {
    if (excludeElement && tag === excludeElement) continue;
    const attrs = writer.tagger.getAttributesForTag(tag);
    const existing =
      attrs[schemaId] ??
      (schemaId !== 'id' ? attrs.id : undefined);
    if (typeof existing === 'string' && existing.trim() === normalized) {
      return tag.getAttribute('_tag') ?? 'element';
    }
  }

  return undefined;
};
