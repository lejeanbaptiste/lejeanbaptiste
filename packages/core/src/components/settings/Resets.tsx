import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { Button, Stack } from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { type FC } from 'react';
import { useActions } from '../../overmind';

const Resets: FC = () => {
  const { editor } = useActions();
  const { enqueueSnackbar } = useSnackbar();

  const handleResetWarning = () => {
    editor.resetDialogWarnings();

    const message = 'Confirmation dialog preferences have been reset';
    enqueueSnackbar(message);
  };

  const handleResetSettings = () => {
    editor.resetPreferences();

    const message = 'Settings preferences have been reset to default';
    enqueueSnackbar(message);
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
        Reset Dialog Warnings
      </Button>
      <Button
        color="inherit"
        onClick={handleResetSettings}
        size="small"
        startIcon={<RestartAltIcon />}
        variant="outlined"
        sx={{ justifyContent: 'flex-start' }}
      >
        Reset Settings
      </Button>
    </Stack>
  );
};

export default Resets;
