import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import { Box, Stack, ToggleButton, Typography } from '@mui/material';
import { CloudSyncOutline } from 'mdi-material-ui';
import React, { type FC } from 'react';
import { useActions, useAppState } from '../../overmind';

export const Autosave: FC = () => {
  const actions = useActions();
  const { editor } = useAppState();

  const handleChange = () => {
    actions.editor.setAutosave(!editor.autosave);
  };

  return (
    <Stack direction="row" alignItems="center">
      <CloudSyncOutline sx={{ mx: 1, height: 18, width: 18 }} />
      <Typography>Autosave</Typography>
      <Box flexGrow={1} />

      <ToggleButton
        color="primary"
        onChange={handleChange}
        selected={editor.autosave}
        size="small"
        sx={{ border: 0 }}
        value={editor.autosave}
      >
        {editor.autosave ? (
          <RemoveIcon sx={{ height: 16, width: 16, transform: 'rotate(90deg)' }} />
        ) : (
          <CircleOutlinedIcon sx={{ height: 16, width: 16 }} />
        )}
      </ToggleButton>
    </Stack>
  );
};
