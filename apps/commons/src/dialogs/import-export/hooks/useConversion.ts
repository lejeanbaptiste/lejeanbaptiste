import { leafwriterAtom } from '@src/jotai';
import { useActions, useAppState } from '@src/overmind';
import { convertDocument } from '@src/services/leaf-te';
import { FileDetail, Resource } from '@src/types';
import { changeFileExtension, renameFileAsCopy } from '@src/utilities';
import { useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { fileDetailAtom, isProcessingAtom, resourceAtom, selectedTypeAtom } from '../store';

export const useConversion = () => {
  const { editor } = useAppState();
  const { notifyViaSnackbar } = useActions().ui;

  const { t } = useTranslation();

  const fileDetail = useAtomValue(fileDetailAtom);
  const selectedType = useAtomValue(selectedTypeAtom);

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

  const processExportFile = async () => {
    if (!editor.resource || !selectedType) return;

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
