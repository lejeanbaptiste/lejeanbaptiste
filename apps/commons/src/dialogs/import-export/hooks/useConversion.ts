import { exportDocument } from '@src/desktop/documentExport';
import { leafwriterAtom } from '@src/jotai';
import { useActions, useAppState } from '@src/overmind';
import { convertDocument } from '@src/services/leaf-te';
import { FileDetail, Resource } from '@src/types';
import { changeFileExtension, renameFileAsCopy } from '@src/utilities';
import { useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  exportIncludeBibliographyAtom,
  exportIncludeTranslationsAtom,
  exportTranslationLangAtom,
  fileDetailAtom,
  isProcessingAtom,
  localExportFormatAtom,
  resourceAtom,
  selectedTypeAtom,
} from '../store';

export const useConversion = () => {
  const { editor, project } = useAppState();
  const { notifyViaSnackbar } = useActions().ui;

  const { t } = useTranslation();

  const fileDetail = useAtomValue(fileDetailAtom);
  const selectedType = useAtomValue(selectedTypeAtom);
  const localFormat = useAtomValue(localExportFormatAtom);
  const includeTranslations = useAtomValue(exportIncludeTranslationsAtom);
  const translationLang = useAtomValue(exportTranslationLangAtom);
  const includeBibliography = useAtomValue(exportIncludeBibliographyAtom);

  const setIsProcessing = useSetAtom(isProcessingAtom);
  const setResource = useSetAtom(resourceAtom);

  const leafwriterEditor = useAtomValue(leafwriterAtom);

  const processImportFile = async (_fileDetail?: FileDetail) => {
    const fileToProcess = _fileDetail ?? fileDetail;
    if (!fileToProcess || !selectedType) return;
    setIsProcessing(true);

    const { content, file } = fileToProcess;

    const convertedContent = await convertDocument({
      content,
      fromType: selectedType,
      toType: 'TEI',
    }).catch((error) => error);

    setIsProcessing(false);

    if (convertedContent instanceof Error) {
      handleProcessError(convertedContent);
      return;
    }

    const filename = renameFileAsCopy(file.name);
    const resource: Resource = { content: convertedContent, filename };

    setResource(resource);
    return resource;
  };

  /** Local formats (RTF/Markdown/text) bypass the remote conversion service entirely —
   * it has no concept of Zotero citations, so anything routed through it would lose the
   * live citation fields and CSL bibliography the export needs to preserve. */
  const processLocalExportFile = async () => {
    if (!editor.resource || !project.activeTabPath) {
      notifyViaSnackbar({
        message: t('LWC.commons.conversion failed') + '. No document is currently open.',
        options: { variant: 'error' },
      });
      return;
    }

    const content = (await leafwriterEditor?.getContent()) ?? (await window.writer?.getContent());
    if (!content) {
      notifyViaSnackbar({
        message: t('LWC.commons.conversion failed') + '. Could not read the document content.',
        options: { variant: 'error' },
      });
      return;
    }
    setIsProcessing(true);

    const result = await exportDocument({
      format: localFormat,
      sourceXml: content,
      sourcePath: project.activeTabPath,
      includeTranslations,
      translationLang,
      includeBibliography,
    }).catch((error) => error as Error);

    setIsProcessing(false);

    if (result instanceof Error) {
      handleProcessError(result);
      return;
    }

    const blob = result.content instanceof Blob ? result.content : new Blob([result.content]);
    const filename = changeFileExtension(editor.resource.filename ?? 'untitled', result.extension);
    const resource: Resource = {
      blob,
      content: typeof result.content === 'string' ? result.content : undefined,
      filename,
    };

    setResource(resource);
    return resource;
  };

  const processExportFile = async () => {
    if (!editor.resource) return;

    if (!selectedType) return processLocalExportFile();

    const content = await leafwriterEditor?.getContent();
    if (!content) return;
    setIsProcessing(true);

    const convertedContent = await convertDocument({
      content,
      fromType: 'TEI',
      toType: selectedType,
    }).catch((error) => error);

    setIsProcessing(false);

    if (convertedContent instanceof Error) {
      handleProcessError(convertedContent);
      return;
    }

    const blob = new Blob([convertedContent]); //, { type: 'text/plain;charset=utf-8' });
    const filename = changeFileExtension(
      editor.resource.filename ?? 'untitled',
      selectedType.toLowerCase(),
    );

    const resource: Resource = { blob, content: convertedContent, filename };

    setResource(resource);
    return resource;
  };

  const handleProcessError = (error: Error) => {
    notifyViaSnackbar({
      message: `${t('LWC.commons.conversion failed')}. ${error.message}`,
      options: { autoHideDuration: 10_000, variant: 'error' },
    });
  };

  return {
    processExportFile,
    processImportFile,
  };
};
