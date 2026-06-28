import {
  buildArchiveDestName,
  isSchemaCheckThrottled,
  SCHEMA_UPDATE_CHECK_INTERVAL_MS,
  schemaHashesDiffer,
  shouldBypassSchemaCheckThrottle,
  validateMetadataPathsAfterUpgrade,
} from './schemaUpdateLogic';

describe('isSchemaCheckThrottled', () => {
  test('returns false when lastCheckedAt is missing', () => {
    expect(isSchemaCheckThrottled(undefined)).toBe(false);
  });

  test('returns true when checked within the interval', () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    expect(isSchemaCheckThrottled(recent)).toBe(true);
  });

  test('returns false when checked before the interval', () => {
    const old = new Date(Date.now() - SCHEMA_UPDATE_CHECK_INTERVAL_MS - 1_000).toISOString();
    expect(isSchemaCheckThrottled(old)).toBe(false);
  });
});

describe('schemaHashesDiffer', () => {
  test('detects RNG and CSS changes', () => {
    const result = schemaHashesDiffer(
      { sourceHash: 'aaa', sourceCssHash: 'bbb' },
      { rngHash: 'ccc', cssHash: 'ddd' },
    );

    expect(result).toEqual({ rngChanged: true, cssChanged: true });
  });

  test('reports no changes when hashes match', () => {
    const result = schemaHashesDiffer(
      { sourceHash: 'aaa', sourceCssHash: 'bbb' },
      { rngHash: 'aaa', cssHash: 'bbb' },
    );

    expect(result).toEqual({ rngChanged: false, cssChanged: false });
  });
});

describe('buildArchiveDestName', () => {
  test('uses version label in archive filename', () => {
    expect(buildArchiveDestName('tei_lite.rng', '4.11.0')).toBe('tei_lite-4.11.0.rng');
  });
});

describe('shouldBypassSchemaCheckThrottle', () => {
  test('bypasses when project file was modified after last check', () => {
    const lastCheckedAt = '2026-06-28T12:00:00.000Z';
    const projectFileMtimeMs = Date.parse('2026-06-28T13:00:00.000Z');
    expect(
      shouldBypassSchemaCheckThrottle(lastCheckedAt, projectFileMtimeMs, 'aaa', 'aaa'),
    ).toBe(true);
  });

  test('bypasses when stored RNG hash does not match on-disk file', () => {
    const lastCheckedAt = new Date().toISOString();
    expect(
      shouldBypassSchemaCheckThrottle(
        lastCheckedAt,
        Date.parse(lastCheckedAt) - 60_000,
        'stored-hash',
        'disk-hash',
      ),
    ).toBe(true);
  });

  test('does not bypass when recently checked and nothing changed', () => {
    const lastCheckedAt = new Date().toISOString();
    const mtimeMs = Date.parse(lastCheckedAt) - 60_000;
    expect(
      shouldBypassSchemaCheckThrottle(lastCheckedAt, mtimeMs, 'same', 'same', 'css', 'css'),
    ).toBe(false);
  });
});

describe('validateMetadataPathsAfterUpgrade', () => {
  test('warns on unknown managed field paths with values', () => {
    const warnings = validateMetadataPathsAfterUpgrade(
      {
        version: 1,
        catalogId: 'teiLite',
        fields: { 'encodingDesc/removed/p': 'still here' },
        custom: [],
      },
      'teiLite',
    );

    expect(warnings.some((warning) => warning.includes('encodingDesc/removed/p'))).toBe(true);
  });

  test('warns on non-empty custom metadata paths', () => {
    const warnings = validateMetadataPathsAfterUpgrade(
      {
        version: 1,
        catalogId: 'teiLite',
        fields: {},
        custom: [{ path: 'profileDesc/textClass/keywords', label: 'Keywords', value: 'TEI' }],
      },
      'teiLite',
    );

    expect(warnings.some((warning) => warning.includes('profileDesc/textClass/keywords'))).toBe(
      true,
    );
  });

  test('does not warn on valid managed fields', () => {
    const warnings = validateMetadataPathsAfterUpgrade(
      {
        version: 1,
        catalogId: 'teiLite',
        fields: { 'titleStmt/principal': 'Ada Lovelace' },
        custom: [],
      },
      'teiLite',
    );

    expect(warnings).toEqual([]);
  });
});
