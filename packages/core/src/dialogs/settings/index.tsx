import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import { Dialog, DialogContent, IconButton, Stack, Typography } from '@mui/material';
import React, { type FC } from 'react';
import { useActions, useAppState } from '../../overmind';
import AutoritiesPanel from './AuthoritySource';
import FontSize from './FontSize';
import Language from './Language';
import Resets from './Resets';
import Section from './Section';
import ShowEntities from './ShowEntities';
import ThemeAppearance from './ThemeAppearance';

export const SettingsDialog: FC = () => {
  const { settings } = useAppState().editor;
  const { settingsDialogOpen } = useAppState().ui;
  const { closeSettingsDialog } = useActions().ui;

  const handleClose = () => closeSettingsDialog();

  return (
    <Dialog
      aria-labelledby="settings-title"
      container={document.getElementById(`${settings?.container}`)}
      fullWidth
      maxWidth="sm"
      onClose={handleClose}
      open={settingsDialogOpen}
    >
      <Stack direction="row" justifyContent="center" alignItems="center" py={2} spacing={2}>
        <TuneIcon sx={{ height: 24, width: 24 }} />
        <Typography sx={{ textTransform: 'capitalize' }} variant="h5">
          Settings
        </Typography>
        <IconButton
          aria-label="close"
          onClick={closeSettingsDialog}
          sx={{
            position: 'absolute',
            right: 8,
            top: 12,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon fontSize="inherit" />
        </IconButton>
      </Stack>
      <DialogContent sx={{ width: 500 }}>
        <Stack spacing={3} sx={{ pt: 2.5 }}>
          <Section title="Interface">
            <ThemeAppearance />
            <Language />
          </Section>
          <Section title="Editor">
            <FontSize />
            <ShowEntities />
          </Section>
          <Section title="Authorities">
            <AutoritiesPanel />
          </Section>
          <Section title="Resets">
            <Resets />
          </Section>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
