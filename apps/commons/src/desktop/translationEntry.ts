import { getActiveProjectBundle } from './activeProjectBundle';
import {
  assignMissingIds,
  createTranslationShell,
  findAlignmentUnitsMissingIds,
  findDuplicateAlignmentUnitIds,
  reindexAlignmentUnits,
  resyncTranslationShell,
} from './translationBootstrap';
import { isTranslationFile, translationFilePathFor } from './translationFileNaming';
import { readTranslationSettings } from './translationSettings';
import { writeTranslationSnapshot } from './translationSnapshot';

const log = (...args: unknown[]) => console.log('[translation]', ...args);

const fileNameOf = (filePath: string): string => {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return idx === -1 ? filePath : filePath.slice(idx + 1);
};

export interface TranslationEnterPayload {
  lang: string;
  sourcePath: string;
  translationPath: string;
  alignmentUnit: 'div' | 'p';
  /** CSL style id for footnote citations (undefined → app default). */
  citationStyle?: string;
}

export interface TranslationEntryContext {
  activeTabPath: string | null;
  isActiveTabDirty: boolean;
  onEnter: (payload: TranslationEnterPayload) => void;
  /** Called after the source file is rewritten with new xml:id attributes, so the caller
   * can suppress the "changed externally" watcher prompt and refresh the open tab's content. */
  onSourceFileWritten: (filePath: string) => Promise<void> | void;
  notify: (message: string) => void;
}

const readFileOrNull = async (filePath: string): Promise<string | null> => {
  try {
    return (await window.electronAPI?.readFile(filePath)) ?? null;
  } catch (error) {
    log('readFile failed', filePath, error);
    return null;
  }
};

/**
 * Ensures a companion translation file exists for (activeTabPath, lang), silently bootstrapping
 * xml:id attributes into the source file on first use, then notifies the caller so the editor
 * can be pointed at it. Safe to call repeatedly (e.g. every time the language dropdown changes)
 * — a no-op past the first call for a given (file, lang).
 */
export const startTranslationForLang = async (
  lang: string,
  ctx: TranslationEntryContext,
): Promise<void> => {
  log('startTranslationForLang', { lang, activeTabPath: ctx.activeTabPath });

  const bundle = getActiveProjectBundle();
  const sourcePath = ctx.activeTabPath;
  log('bundle?', !!bundle, 'sourcePath', sourcePath);
  if (!bundle || !sourcePath) {
    ctx.notify('Open a file to start a translation.');
    return;
  }
  if (ctx.isActiveTabDirty) {
    ctx.notify('Save this file before starting a translation.');
    return;
  }

  const settings = await readTranslationSettings(bundle);
  log('settings', settings);
  if (!settings) {
    ctx.notify('Configure translation languages in Edition metadata first.');
    return;
  }

  const sourceFileName = fileNameOf(sourcePath);
  const translationPath = translationFilePathFor(sourcePath, lang);
  log('sourceFileName', sourceFileName, 'translationPath', translationPath);

  const existingTranslationXml = await readFileOrNull(translationPath);
  log('existingTranslationXml found?', !!existingTranslationXml);
  if (existingTranslationXml) {
    ctx.onEnter({
      lang,
      sourcePath,
      translationPath,
      alignmentUnit: settings.alignmentUnit,
      citationStyle: settings.citationStyle,
    });
    return;
  }

  const sourceXml = await readFileOrNull(sourcePath);
  log('sourceXml read?', !!sourceXml, sourceXml?.length);
  if (!sourceXml) {
    ctx.notify('Could not read the source file.');
    return;
  }

  const sourceDoc = new DOMParser().parseFromString(sourceXml, 'application/xml');
  const parserError = sourceDoc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    log('XML parse error', parserError.textContent);
    ctx.notify('Could not parse the source file as XML.');
    return;
  }

  const missing = findAlignmentUnitsMissingIds(sourceDoc, settings.alignmentUnit);
  log('missing alignment-unit ids count', missing.length);

  if (missing.length > 0) {
    await assignMissingIds(sourceDoc, missing);
    const nextSourceXml = new XMLSerializer().serializeToString(sourceDoc);
    await window.electronAPI?.writeFile(sourcePath, nextSourceXml);
    log('wrote source file with new ids');
    await ctx.onSourceFileWritten(sourcePath);
    log('onSourceFileWritten completed');
  }

  const shellDoc = createTranslationShell(sourceDoc, sourceFileName, lang, settings.alignmentUnit);
  await window.electronAPI?.writeFile(
    translationPath,
    new XMLSerializer().serializeToString(shellDoc),
  );
  log('wrote translation companion file');

  await writeTranslationSnapshot(bundle, sourceFileName, sourceDoc, settings.alignmentUnit);

  ctx.onEnter({
    lang,
    sourcePath,
    translationPath,
    alignmentUnit: settings.alignmentUnit,
    citationStyle: settings.citationStyle,
  });
  log('onEnter dispatched');
};

/**
 * Called automatically right after any file is saved. Silently fixes duplicated/missing
 * xml:id attributes at the alignment-unit level (e.g. after splitting a paragraph in the
 * editor copies xml:id onto both halves), then resyncs every configured language's companion
 * file: units whose id survived keep their translated content, newly split-off units start
 * empty rather than inheriting a copy of the paragraph they were split from.
 *
 * Gated on the Translation tab actually being open (window.__desktopTranslationTabActive) so
 * saving files has no extra cost when translation isn't in use.
 *
 * Returns the updated source XML if it changed (caller should reload the tab/editor from
 * disk), or null if nothing needed fixing.
 */
export const reindexTranslationOnSave = async (
  filePath: string,
  xml: string,
): Promise<string | null> => {
  if (!window.__desktopTranslationTabActive) return null;
  if (isTranslationFile(filePath)) return null;

  const bundle = getActiveProjectBundle();
  if (!bundle) return null;

  const settings = await readTranslationSettings(bundle);
  if (!settings || settings.languages.length === 0) return null;

  const sourceDoc = new DOMParser().parseFromString(xml, 'application/xml');
  if (sourceDoc.getElementsByTagName('parsererror')[0]) return null;

  const duplicates = findDuplicateAlignmentUnitIds(sourceDoc, settings.alignmentUnit);
  const missing = findAlignmentUnitsMissingIds(sourceDoc, settings.alignmentUnit);
  if (duplicates.length === 0 && missing.length === 0) {
    // Doc already clean: still refresh the recovery snapshot so it tracks the last good save.
    await writeTranslationSnapshot(bundle, fileNameOf(filePath), sourceDoc, settings.alignmentUnit);
    return null;
  }

  log('reindexTranslationOnSave: fixing', {
    filePath,
    duplicateGroups: duplicates.length,
    missing: missing.length,
  });

  await reindexAlignmentUnits(sourceDoc, settings.alignmentUnit);
  const nextXml = new XMLSerializer().serializeToString(sourceDoc);
  const sourceFileName = fileNameOf(filePath);

  for (const language of settings.languages) {
    const translationPath = translationFilePathFor(filePath, language.code);
    // eslint-disable-next-line no-await-in-loop
    const existingXml = await readFileOrNull(translationPath);
    const existingDoc = existingXml
      ? new DOMParser().parseFromString(existingXml, 'application/xml')
      : new DOMParser().parseFromString(
          `<translation xml:lang="${language.code}" corresp="${sourceFileName}"/>`,
          'application/xml',
        );
    const resynced = resyncTranslationShell(
      sourceDoc,
      existingDoc,
      sourceFileName,
      language.code,
      settings.alignmentUnit,
    );
    // eslint-disable-next-line no-await-in-loop
    await window.electronAPI?.writeFile(
      translationPath,
      new XMLSerializer().serializeToString(resynced),
    );
    log('resynced companion file for', language.code);
  }

  await window.electronAPI?.writeFile(filePath, nextXml);
  await writeTranslationSnapshot(bundle, sourceFileName, sourceDoc, settings.alignmentUnit);
  window.dispatchEvent(new CustomEvent('desktop:translation-reindexed'));

  return nextXml;
};
