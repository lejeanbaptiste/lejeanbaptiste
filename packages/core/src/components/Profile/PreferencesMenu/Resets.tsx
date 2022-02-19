import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import {
  Button,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useActions } from '@src/overmind';
import { useSnackbar } from 'notistack';
import React, { FC } from 'react';

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
    <Stack>
      <Stack direction="row" sx={{ padding: 2 }}>
        <RotateLeftIcon fontSize="small" sx={{ mr: 2, mt: 0.25 }} />
        <Typography>Resets</Typography>
      </Stack>
      <ListItem>
        <ListItemText primary="Dialog Warnings" />
        <ListItemSecondaryAction>
          <Button color="inherit" onClick={handleResetWarning} size="small">
            Reset
          </Button>
        </ListItemSecondaryAction>
      </ListItem>
      <ListItem>
        <ListItemText primary="Settings" />
        <ListItemSecondaryAction>
          <Button color="inherit" onClick={handleResetSettings} size="small">
            Reset
          </Button>
        </ListItemSecondaryAction>
      </ListItem>
    </Stack>
  );
};

export default Resets;
