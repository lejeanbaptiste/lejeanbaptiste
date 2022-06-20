import { Dialog, DialogContent, DialogTitle, Stack, useTheme } from '@mui/material';
import React, { type FC } from 'react';
import { useActions, useAppState } from '../../overmind';
import AutoritiesPanel from './AuthoritySource';
import FontSize from './FontSize';
import Language from './Language';
import Resets from './Resets';
import Section from './Section';
import ShowEntities from './ShowEntities';
import ThemeAppearance from './ThemeAppearance';

const SettingsDialog: FC = () => {
  const { settingsDialogOpen } = useAppState().ui;
  const { closeSettingsDialog } = useActions().ui;

  const { palette } = useTheme();

  const handleClose = () => {
    closeSettingsDialog();
  };

  return (
    <Dialog
      aria-labelledby="settings-title"
      fullWidth
      maxWidth="sm"
      onClose={handleClose}
      open={settingsDialogOpen}
    >
      <DialogTitle
        id="settings-title"
        sx={{
          textAlign: 'center',
          backgroundColor: palette.mode === 'dark' ? '#222' : '#eee',
        }}
      >
        Settings
      </DialogTitle>
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

export default SettingsDialog;
