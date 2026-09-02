import {
  countImportedParagraphs,
  formatDocumentImportReportDetail,
  formatSchemaValidationLabel,
  summarizeDocumentImportReport,
  type DocumentImportReportEntry,
} from './documentImportReport';

const t = (key: string, options?: Record<string, unknown>) => {
  if (key.endsWith('schema_valid')) return 'Schema: valid';
  if (key.endsWith('schema_invalid')) {
    return `Schema: ${options?.count} error(s) — ${options?.message}`;
  }
  if (key.endsWith('paragraphs')) return `${options?.count} paragraph block(s)`;
  if (key.endsWith('keys_demoted')) return `${options?.count} foreign key(s) moved to @ana`;
  if (key.endsWith('more_files')) return `…and ${options?.count} more file(s)`;
  return key;
};

describe('documentImportReport', () => {
  test('counts TEI and Orlando paragraph tags', () => {
    expect(countImportedParagraphs('<body><p>One</p><p>Two</p><P>Three</P></body>')).toBe(3);
  });

  test('formats per-file report lines with schema status and paragraph count', () => {
    const entries: DocumentImportReportEntry[] = [
      {
        keysDemoted: 2,
        outputPath: '/project/imported/sample.xml',
        paragraphCount: 4,
        schemaValidation: { status: 'valid' },
        sourceFormat: 'txt',
        sourcePath: '/incoming/sample.txt',
      },
    ];

    expect(formatDocumentImportReportDetail(entries, t)).toBe(
      'sample.txt (txt) → sample.xml · 4 paragraph block(s) · Schema: valid · 2 foreign key(s) moved to @ana',
    );
  });

  test('summarizes schema validation outcomes', () => {
    const entries: DocumentImportReportEntry[] = [
      { schemaValidation: { status: 'valid' } } as DocumentImportReportEntry,
      {
        schemaValidation: { status: 'invalid', errorCount: 3, firstMessage: 'Bad child' },
      } as DocumentImportReportEntry,
      {
        schemaValidation: { status: 'unavailable', reason: 'no-schema' },
      } as DocumentImportReportEntry,
    ];

    expect(summarizeDocumentImportReport(entries)).toEqual({
      schemaInvalidCount: 1,
      schemaUnavailableCount: 1,
      schemaValidCount: 1,
    });
  });

  test('labels invalid schema results with the first error message', () => {
    expect(
      formatSchemaValidationLabel(
        { status: 'invalid', errorCount: 2, firstMessage: 'Element body is not allowed here' },
        t,
      ),
    ).toBe('Schema: 2 error(s) — Element body is not allowed here');
  });
});
