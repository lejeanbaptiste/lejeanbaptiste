import { Stack } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useActions } from '../../../overmind';
import { Button } from '../components';

export const Reset = () => {
  const { resetDialogWarnings, resetPreferences } = useActions().editor;
  const { notifyViaSnackbar } = useActions().ui;
  const { t } = useTranslation('leafwriter');

  return (
    <Stack direction="row">
      <Button
        icon="reset"
        onClick={() => {
          resetDialogWarnings();
          notifyViaSnackbar(t('Confirmation dialog preferences have been reset').toString());
        }}
      >
        {t('Reset Dialog Warnings')}
      </Button>
      <Button
        icon="reset"
        onClick={() => {
          resetPreferences();
          notifyViaSnackbar(t('Settings preferences have been reset to default').toString());
        }}
      >
        {t('Reset Settings')}
      </Button>
    </Stack>
  );
};
