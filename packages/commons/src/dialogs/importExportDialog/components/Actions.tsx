import { LoadingButton } from '@mui/lab';
import { Button, DialogActions } from '@mui/material';
import { useOpenResource } from '@src/hooks';
import { saveAs } from 'file-saver';
import { useAtomValue, useSetAtom } from 'jotai';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useConversion } from '../hooks/useConversion';
import {
  cancelActionAtom,
  dialogActionAtom,
  fileDetailAtom,
  isProcessingAtom,
  resourceAtom,
} from '../store';

export type DialogAction = 'cancel' | 'select';

type ActionsProps = {
  onAction: (action: DialogAction) => void;
};

export const Actions = ({ onAction }: ActionsProps) => {
  const { t } = useTranslation('LWC');

  const { processExportFile, processImportFile } = useConversion();
  const { openResource } = useOpenResource();

  const dialogAction = useAtomValue(dialogActionAtom);
  const fileDetail = useAtomValue(fileDetailAtom);
  const isProcessing = useAtomValue(isProcessingAtom);
  const resource = useAtomValue(resourceAtom);

  const cancelAction = useSetAtom(cancelActionAtom);
  const setResource = useSetAtom(resourceAtom);

  useEffect(() => {
    if (!resource) return;

    if (dialogAction == 'import') {
      openResource({ resource });
    }

    if (dialogAction == 'export' && resource?.blob) {
      saveAs(resource.blob, resource.filename);
    }

    setResource(undefined);
    onAction('select');
  }, [resource]);

  const handleCancel = () => {
    cancelAction();
    onAction('cancel');
  };

  const handleSelect = async () => {
    dialogAction === 'import' ? handleImport() : handleExport();
  };

  const handleImport = async () => {
    const resource = await processImportFile();
    if (!resource) return;

    onAction('select');
    await openResource({ resource });
    setResource(undefined);
  };

  const handleExport = async () => {
    const resource = await processExportFile();
    if (!resource?.blob) return;

    onAction('select');
    saveAs(resource.blob, resource.filename);
    setResource(undefined);
  };

  return (
    <DialogActions sx={{ justifyContent: 'space-between' }}>
      <Button onClick={handleCancel}>{t('LWC:commons.cancel')}</Button>
      <LoadingButton
        disabled={dialogAction === 'import' ? !fileDetail : false}
        loading={isProcessing}
        onClick={handleSelect}
        variant="outlined"
      >
        <span>{dialogAction === 'import' ? t('LWC:storage.import') : t('LWC:storage.export')}</span>
      </LoadingButton>
    </DialogActions>
  );
};
