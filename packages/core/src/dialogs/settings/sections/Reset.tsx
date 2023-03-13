import { Stack } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useActions } from '../../../overmind';
import { Button } from '../components';

export const Reset = () => {
  const { resetDialogWarnings, resetPreferences } = useActions().editor;
  const { notifyViaSnackbar } = useActions().ui;
  const { t } = useTranslation();

  return (
    <Stack direction="row">
      <Button
        icon="reset"
        onClick={() => {
          resetDialogWarnings();
          notifyViaSnackbar(t('Confirmation dialog preferences have been reset'));
        }}
      >
        {t('Reset Dialog Warnings')}
      </Button>
      <Button
        icon="reset"
        onClick={() => {
          resetPreferences();
          notifyViaSnackbar(t('Settings preferences have been reset to default'));
        }}
      >
        {t('Reset Settings')}
      </Button>
    </Stack>
  );
};
