import {
  buildDocxDocument,
  buildMarkdownDocument,
  buildOdtDocument,
  buildPlainTextDocument,
  buildRtfDocument,
  collectAllUnitIds,
  findUnitByCorresp,
  findUnitById,
  type ExportBiblEntry,
  type ExportUnitPair,
} from '@cwrc/leafwriter/documentExport';
import { getActiveProjectBundle } from './activeProjectBundle';
import { createCitationRenderer } from './citations/citeproc';
import { resolveLocale, resolveStyle } from './citations/styleAssets';
import { readBiblEntries } from './citations/zoteroBibliography';
import { findCompanionTranslationFiles } from './translationCompanionOps';
import { readTranslationSettings } from './translationSettings';

/**
 * Orchestrates whole-document export to RTF/Markdown/text: resolves the translation
 * companion (if requested), reads the Zotero bibliography, renders it via the project's
 * configured CSL style, and delegates the actual format serialization to the pure
 * @cwrc/leafwriter builders (documentExport.ts there), which reuse the same block-walking
 * and live-Zotero-field logic as the existing "Copy for export" clipboard feature.
 */

export type ExportFormat = 'rtf' | 'markdown' | 'text' | 'docx' | 'odt';

export interface DocumentExportOptions {
  format: ExportFormat;
  /** Current in-editor TEI content — may include unsaved edits. */
  sourceXml: string;
  /** Full path of the currently open source file, used to resolve its translation
   * companion(s) and to match translation units via @corresp="filename#id". */
  sourcePath: string;
  includeTranslations: boolean;
  /** Required when includeTranslations is true and the project has more than one
   * configured translation language. */
  translationLang?: string;
  includeBibliography: boolean;
}

export interface DocumentExportResult {
  /** RTF/Markdown/text serialize to a string; docx is a binary zip, produced as a Blob
   * directly by the docx library. */
  content: string | Blob;
  /** File extension (without the dot) matching the chosen format. */
  extension: string;
}

const fileNameOf = (filePath: string): string => {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return idx === -1 ? filePath : filePath.slice(idx + 1);
};

const parseXml = (xml: string): Document => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Could not parse the source document.');
  }
  return doc;
};

const EXTENSION_BY_FORMAT: Record<ExportFormat, string> = {
  rtf: 'rtf',
  markdown: 'md',
  text: 'txt',
  docx: 'docx',
  odt: 'odt',
};

export const exportDocument = async (
  options: DocumentExportOptions,
): Promise<DocumentExportResult> => {
  const { format, sourceXml, sourcePath, includeTranslations, translationLang } = options;

  const sourceDoc = parseXml(sourceXml);
  const bundle = getActiveProjectBundle();
  const settings = bundle ? await readTranslationSettings(bundle) : null;
  const alignmentUnit = settings?.alignmentUnit ?? 'p';

  let translationDoc: Document | null = null;
  if (includeTranslations && settings) {
    const companions = await findCompanionTranslationFiles(sourcePath);
    const companion = translationLang
      ? companions.find((entry) => entry.lang === translationLang)
      : companions[0];
    if (companion && window.electronAPI?.readFile) {
      translationDoc = parseXml(await window.electronAPI.readFile(companion.path));
    }
  }

  const sourceFileName = fileNameOf(sourcePath);
  const unitIds = collectAllUnitIds(sourceDoc, alignmentUnit);
  const pairs: ExportUnitPair[] = unitIds.map((unitId) => ({
    source: findUnitById(sourceDoc, alignmentUnit, unitId),
    translation: translationDoc
      ? findUnitByCorresp(translationDoc, alignmentUnit, sourceFileName, unitId)
      : null,
  }));

  const biblEntries: Map<string, ExportBiblEntry> = translationDoc
    ? readBiblEntries(translationDoc)
    : new Map();

  let bibliography: { id: string; tei: string }[] = [];
  if (options.includeBibliography && biblEntries.size > 0) {
    const renderer = createCitationRenderer(
      resolveStyle(settings?.citationStyle),
      resolveLocale(translationLang),
    );
    bibliography = renderer.renderBibliography(
      Array.from(biblEntries.values()).map((entry) => entry.csl),
    );
  }

  const content: string | Blob =
    format === 'rtf'
      ? buildRtfDocument(pairs, biblEntries, bibliography)
      : format === 'markdown'
        ? buildMarkdownDocument(pairs, biblEntries, bibliography)
        : format === 'docx'
          ? await buildDocxDocument(pairs, biblEntries, bibliography)
          : format === 'odt'
            ? await buildOdtDocument(pairs, biblEntries, bibliography)
            : buildPlainTextDocument(pairs, biblEntries, bibliography);

  return { content, extension: EXTENSION_BY_FORMAT[format] };
};
