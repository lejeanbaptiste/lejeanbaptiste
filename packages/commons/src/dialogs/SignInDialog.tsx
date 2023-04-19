import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material';
import { ProviderButton } from '@src/components';
import { useActions, useAppState } from '@src/overmind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import type { IDialog } from './type';

export const SignInDialog = ({ id = uuidv4(), open = true }: IDialog) => {
  const { authProviders } = useAppState().providers;
  const { closeDialog } = useActions().ui;

  const { t } = useTranslation('LWC');

  const handleClose = (_event: MouseEvent) => closeDialog(id);
  const handleCancel = () => closeDialog(id);

  return (
    <Dialog id={id} fullWidth maxWidth="xs" onClose={handleClose} open={open}>
      <DialogTitle textAlign="center" sx={{ '::first-letter': { textTransform: 'uppercase' } }}>
        {t('commons.sign in')} {t('commons.with')}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2} py={5} alignItems="center">
          {authProviders.map(({ providerId }) => (
            <ProviderButton key={providerId} name={providerId} />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center' }}>
        <Button onClick={handleCancel}>{t('commons.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
};
