import {
  normalizeAttributeNameForSchema,
  SCHEMA_ID_VALUE_PATTERN,
  validateSchemaIdValue,
} from './attributeIdHelpers';

describe('attributeIdHelpers', () => {
  beforeEach(() => {
    (window as unknown as { writer: unknown }).writer = {
      schemaManager: { getIdName: () => 'xml:id' },
    };
  });

  test('normalizeAttributeNameForSchema maps id to xml:id', () => {
    expect(normalizeAttributeNameForSchema('id')).toBe('xml:id');
    expect(normalizeAttributeNameForSchema('xml:id')).toBe('xml:id');
    expect(normalizeAttributeNameForSchema('ref')).toBe('ref');
  });

  test('validateSchemaIdValue accepts NCName-like values', () => {
    expect(validateSchemaIdValue('Jean')).toBeUndefined();
    expect(validateSchemaIdValue('place_1')).toBeUndefined();
    expect(SCHEMA_ID_VALUE_PATTERN.test('p1')).toBe(true);
  });

  test('validateSchemaIdValue rejects invalid values', () => {
    expect(validateSchemaIdValue('')).toMatch(/empty/i);
    expect(validateSchemaIdValue('2bad')).toMatch(/letter or underscore/i);
    expect(validateSchemaIdValue('has space')).toMatch(/letter or underscore/i);
  });
});
