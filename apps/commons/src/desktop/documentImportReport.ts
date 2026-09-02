import type { ImportableDocumentFormat } from './documentImport';
import type { ImportRelaxNgValidation } from './documentImportValidation';

export interface DocumentImportReportEntry {
  keysDemoted: number;
  outputPath: string;
  paragraphCount: number;
  schemaValidation: ImportRelaxNgValidation;
  sourceFormat: ImportableDocumentFormat;
  sourcePath: string;
}

/** Count paragraph blocks emitted in imported TEI / Orlando body markup. */
export const countImportedParagraphs = (xml: string): number => {
  const matches = xml.match(/<(p|P)\b[^>]*>/g);
  return matches?.length ?? 0;
};

const basename = (filePath: string): string => filePath.split(/[/\\]/).pop() ?? filePath;

export const formatSchemaValidationLabel = (
  validation: ImportRelaxNgValidation,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  switch (validation.status) {
    case 'valid':
      return t('LWC.desktop.project.import_report.schema_valid');
    case 'invalid':
      return t('LWC.desktop.project.import_report.schema_invalid', {
        count: validation.errorCount,
        message: validation.firstMessage,
      });
    case 'skipped':
      return t('LWC.desktop.project.import_report.schema_skipped_not_well_formed');
    case 'unavailable': {
      const reasonKey = validation.reason.replace(/-/g, '_');
      return t(`LWC.desktop.project.import_report.schema_unavailable_${reasonKey}`);
    }
    default:
      return t('LWC.desktop.project.import_report.schema_unavailable_worker-unavailable');
  }
};

export const formatDocumentImportReportDetail = (
  entries: DocumentImportReportEntry[],
  t: (key: string, options?: Record<string, unknown>) => string,
  options?: { maxLines?: number },
): string => {
  const maxLines = options?.maxLines ?? 12;
  const lines = entries.slice(0, maxLines).map((entry) => {
    const sourceName = basename(entry.sourcePath);
    const outputName = basename(entry.outputPath);
    const keys =
      entry.keysDemoted > 0
        ? t('LWC.desktop.project.import_report.keys_demoted', { count: entry.keysDemoted })
        : null;
    const parts = [
      `${sourceName} (${entry.sourceFormat}) → ${outputName}`,
      t('LWC.desktop.project.import_report.paragraphs', { count: entry.paragraphCount }),
      formatSchemaValidationLabel(entry.schemaValidation, t),
      keys,
    ].filter(Boolean);
    return parts.join(' · ');
  });

  if (entries.length > maxLines) {
    lines.push(
      t('LWC.desktop.project.import_report.more_files', {
        count: entries.length - maxLines,
      }),
    );
  }

  return lines.join('\n');
};

export const summarizeDocumentImportReport = (
  entries: DocumentImportReportEntry[],
): {
  schemaInvalidCount: number;
  schemaUnavailableCount: number;
  schemaValidCount: number;
} => {
  let schemaValidCount = 0;
  let schemaInvalidCount = 0;
  let schemaUnavailableCount = 0;

  for (const entry of entries) {
    const { status } = entry.schemaValidation;
    if (status === 'valid') schemaValidCount += 1;
    else if (status === 'invalid') schemaInvalidCount += 1;
    else schemaUnavailableCount += 1;
  }

  return { schemaInvalidCount, schemaUnavailableCount, schemaValidCount };
};
