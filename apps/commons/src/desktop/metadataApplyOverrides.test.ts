import { mergeMetadataIntoHeader } from './projectMetadata';
import {
  buildLastAppliedSnapshot,
  filterEntriesForFile,
  shouldSkipPathForFile,
} from './metadataApplyOverrides';
import { buildTeiSkeletonXml } from './schemaTemplates';
import type { ProjectMetadataFile } from './projectTypes';

const teiXmlWithField = (path: string, value: string) =>
  mergeMetadataIntoHeader(
    buildTeiSkeletonXml({
      schema: { catalogId: 'teiLite', rng: 'schema/tei_lite.rng', css: 'schema/tei.css' },
    }),
    { version: 1, catalogId: 'teiLite', fields: { [path]: value }, custom: [] },
  );

describe('shouldSkipPathForFile', () => {
  test('skips when file diverged from last applied value', () => {
    expect(shouldSkipPathForFile('Custom value', 'Default A', 'Default B')).toBe(true);
  });

  test('does not skip when file still matches last applied', () => {
    expect(shouldSkipPathForFile('Default A', 'Default A', 'Default B')).toBe(false);
  });

  test('does not skip when file value is blank', () => {
    expect(shouldSkipPathForFile('', 'Default A', 'Default B')).toBe(false);
  });
});

describe('filterEntriesForFile', () => {
  const lastApplied: ProjectMetadataFile['lastApplied'] = {
    at: '2026-06-01T00:00:00.000Z',
    fields: { 'titleStmt/principal': 'Project Encoder' },
    custom: [],
  };

  test('detects per-file override', () => {
    const xml = teiXmlWithField('titleStmt/principal', 'File-specific Encoder');
    const entries = [{ path: 'titleStmt/principal', value: 'New Project Encoder' }];

    const { entries: filtered, overridesSkipped } = filterEntriesForFile(
      xml,
      entries,
      lastApplied,
      'teiLite',
    );

    expect(filtered).toHaveLength(0);
    expect(overridesSkipped).toBe(1);
  });

  test('allows update when file still has last applied value', () => {
    const xml = teiXmlWithField('titleStmt/principal', 'Project Encoder');
    const entries = [{ path: 'titleStmt/principal', value: 'New Project Encoder' }];

    const { entries: filtered, overridesSkipped } = filterEntriesForFile(
      xml,
      entries,
      lastApplied,
      'teiLite',
    );

    expect(filtered).toHaveLength(1);
    expect(overridesSkipped).toBe(0);
  });

  test('applies all entries when no lastApplied snapshot', () => {
    const xml = teiXmlWithField('titleStmt/principal', 'Anything');
    const entries = [{ path: 'titleStmt/principal', value: 'New Value' }];

    const { entries: filtered, overridesSkipped } = filterEntriesForFile(
      xml,
      entries,
      undefined,
      'teiLite',
    );

    expect(filtered).toHaveLength(1);
    expect(overridesSkipped).toBe(0);
  });
});

describe('buildLastAppliedSnapshot', () => {
  test('copies fields and custom rows', () => {
    const metadata: ProjectMetadataFile = {
      version: 1,
      catalogId: 'teiLite',
      fields: { 'titleStmt/principal': 'Ada' },
      custom: [{ path: 'encodingDesc/projectDesc/p', label: 'Note', value: 'Hi' }],
    };

    const snapshot = buildLastAppliedSnapshot(metadata);

    expect(snapshot.fields['titleStmt/principal']).toBe('Ada');
    expect(snapshot.custom[0]?.value).toBe('Hi');
    expect(snapshot.at).toBeTruthy();
  });
});
