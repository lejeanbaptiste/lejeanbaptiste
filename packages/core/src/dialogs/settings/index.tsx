import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import { Dialog, DialogContent, IconButton, Stack, Typography } from '@mui/material';
import React, { type FC } from 'react';
import { useAppState } from '../../overmind';
import { IDialog } from '../type';
import AutoritiesPanel from './AuthoritySource';
import FontSize from './FontSize';
import Language from './Language';
import Resets from './Resets';
import Section from './Section';
import ShowEntities from './ShowEntities';
import ThemeAppearance from './ThemeAppearance';
import { useTranslation } from 'react-i18next';

export const SettingsDialog: FC<IDialog> = ({ id, onClose, open }) => {
  const { settings } = useAppState().editor;

  const { t } = useTranslation(['leafwriter']);

  const handleClose = () => onClose(id);

  return (
    <Dialog
      aria-labelledby="settings-title"
      container={document.getElementById(`${settings?.container}`)}
      fullWidth
      maxWidth="sm"
      onClose={handleClose}
      open={open}
    >
      <Stack direction="row" justifyContent="center" alignItems="center" py={2} spacing={2}>
        <TuneIcon sx={{ height: 24, width: 24 }} />
        <Typography sx={{ textTransform: 'capitalize' }} variant="h5">
          {t('Settings')}
        </Typography>
        <IconButton
          aria-label="close"
          onClick={handleClose}
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
