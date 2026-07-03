import {
  applyTemplateDefaults,
  parseMetadataFieldsTemplate,
  resolveFileMetadataFields,
  resolveProjectMetadataFields,
} from './metadataFieldsTemplate';
import { TEI_V1_METADATA_FIELDS } from './schemaMetadataFields';
import { TEI_FILE_METADATA_FIELDS } from './fileMetadata';

describe('parseMetadataFieldsTemplate', () => {
  test('parses project and file field lists', () => {
    const template = parseMetadataFieldsTemplate(
      JSON.stringify({
        version: 1,
        project: [
          { path: 'titleStmt/funder', label: 'Funder', default: 'Collège de France' },
        ],
        file: [{ path: 'sourceDesc/p', label: 'Source', multiline: true }],
      }),
    );

    expect(template?.project).toEqual([
      { path: 'titleStmt/funder', label: 'Funder', default: 'Collège de France' },
    ]);
    expect(template?.file).toEqual([
      { path: 'sourceDesc/p', label: 'Source', multiline: true },
    ]);
  });

  test('falls back to path when label is missing and drops empty paths', () => {
    const template = parseMetadataFieldsTemplate(
      JSON.stringify({
        project: [{ path: 'titleStmt/funder' }, { path: '   ' }, { label: 'no path' }],
      }),
    );

    expect(template?.project).toEqual([
      { path: 'titleStmt/funder', label: 'titleStmt/funder' },
    ]);
  });

  test('returns null for invalid JSON or empty templates', () => {
    expect(parseMetadataFieldsTemplate('not json')).toBeNull();
    expect(parseMetadataFieldsTemplate('{}')).toBeNull();
    expect(parseMetadataFieldsTemplate('{"project": []}')).toBeNull();
    expect(parseMetadataFieldsTemplate('null')).toBeNull();
  });
});

describe('resolveProjectMetadataFields', () => {
  test('uses template project fields when present', () => {
    const template = parseMetadataFieldsTemplate(
      JSON.stringify({ project: [{ path: 'titleStmt/funder', label: 'Funder' }] }),
    );

    const resolved = resolveProjectMetadataFields(template, 'teiLite');
    expect(resolved.fields).toEqual([{ path: 'titleStmt/funder', label: 'Funder' }]);
    expect(resolved.note).toContain('metadata-fields.json');
  });

  test('falls back to catalog defaults without a template', () => {
    const resolved = resolveProjectMetadataFields(null, 'teiLite');
    expect(resolved.fields).toEqual(TEI_V1_METADATA_FIELDS);
  });

  test('falls back to catalog defaults when template only has file fields', () => {
    const template = parseMetadataFieldsTemplate(
      JSON.stringify({ file: [{ path: 'titleStmt/title', label: 'Title' }] }),
    );

    const resolved = resolveProjectMetadataFields(template, 'teiLite');
    expect(resolved.fields).toEqual(TEI_V1_METADATA_FIELDS);
  });
});

describe('resolveFileMetadataFields', () => {
  test('uses template file fields when present', () => {
    const template = parseMetadataFieldsTemplate(
      JSON.stringify({ file: [{ path: 'notesStmt/note', label: 'Note' }] }),
    );

    expect(resolveFileMetadataFields(template, 'teiLite')).toEqual([
      { path: 'notesStmt/note', label: 'Note' },
    ]);
  });

  test('falls back to catalog defaults without a template', () => {
    expect(resolveFileMetadataFields(null, 'teiLite')).toEqual(TEI_FILE_METADATA_FIELDS);
  });
});

describe('applyTemplateDefaults', () => {
  const template = parseMetadataFieldsTemplate(
    JSON.stringify({
      project: [
        { path: 'titleStmt/funder', label: 'Funder', default: 'Collège de France' },
        { path: 'publicationStmt/distributor', label: 'Publisher' },
      ],
    }),
  );

  test('fills empty values from template defaults', () => {
    const values = applyTemplateDefaults(
      { 'titleStmt/funder': '', 'publicationStmt/distributor': '' },
      template,
    );

    expect(values['titleStmt/funder']).toBe('Collège de France');
    expect(values['publicationStmt/distributor']).toBe('');
  });

  test('does not overwrite stored values', () => {
    const values = applyTemplateDefaults({ 'titleStmt/funder': 'ERC' }, template);
    expect(values['titleStmt/funder']).toBe('ERC');
  });
});
