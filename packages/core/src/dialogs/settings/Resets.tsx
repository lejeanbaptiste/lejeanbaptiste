import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { Button, Stack } from '@mui/material';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions } from '../../overmind';

const Resets: FC = () => {
  const { resetDialogWarnings, resetPreferences } = useActions().editor;
  const { notifyViaSnackbar } = useActions().ui;
  const { t } = useTranslation();

  const handleResetWarning = () => {
    resetDialogWarnings();

    const message = t('Confirmation dialog preferences have been reset');
    notifyViaSnackbar(message);
  };

  const handleResetSettings = () => {
    resetPreferences();

    const message = t('Settings preferences have been reset to default');
    notifyViaSnackbar(message);
  };

  return (
    <Stack alignItems="flex-start" spacing={1} py={1}>
      <Button
        color="inherit"
        onClick={handleResetWarning}
        size="small"
        startIcon={<RestartAltIcon />}
        variant="outlined"
        sx={{ justifyContent: 'flex-start' }}
      >
        {t('Reset Dialog Warnings')}
      </Button>
      <Button
        color="inherit"
        onClick={handleResetSettings}
        size="small"
        startIcon={<RestartAltIcon />}
        variant="outlined"
        sx={{ justifyContent: 'flex-start' }}
      >
        {t('Reset Settings')}
      </Button>
    </Stack>
  );
};

export default Resets;
