import { SOURCE_LANGUAGE_PATH } from './projectLanguage';
import { TEI_V1_METADATA_FIELDS, getMetadataFieldsForCatalog } from './schemaMetadataFields';

describe('getMetadataFieldsForCatalog', () => {
  test('CBETA P5 uses the standard TEI edition fields', () => {
    const resolved = getMetadataFieldsForCatalog('cbeta');
    expect(resolved.kind).toBe('tei');
    expect(resolved.fields).toEqual(TEI_V1_METADATA_FIELDS);
  });

  test('CBETA P5 exposes the mandatory source-language field (onboarding gate)', () => {
    // Without this the project-metadata dialog renders no language picker and
    // onboarding can never complete → "could not open project folder" snackbar.
    const paths = getMetadataFieldsForCatalog('cbeta').fields.map((field) => field.path);
    expect(paths).toContain(SOURCE_LANGUAGE_PATH);
  });

  test('an unknown catalog still falls back to the empty custom set', () => {
    const resolved = getMetadataFieldsForCatalog('something-else');
    expect(resolved.kind).toBe('custom');
    expect(resolved.fields).toEqual([]);
  });
});
