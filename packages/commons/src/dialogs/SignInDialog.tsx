import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material';
import { ProviderButton } from '@src/components';
import { useActions } from '@src/overmind';
import { supportedAuthProviders } from '@src/services';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import type { IDialog } from './type';

export const SignInDialog: FC<IDialog> = ({ id = uuidv4(), open = true }) => {
  const { closeDialog } = useActions().ui;

  const { t } = useTranslation('commons');

  const handleClose = (_event: MouseEvent, reason: string) => closeDialog(id);
  const handleCancel = () => closeDialog(id);

  return (
    <Dialog id={id} fullWidth maxWidth="xs" onClose={handleClose} open={open}>
      <DialogTitle textAlign="center" sx={{ ':first-letter': { textTransform: 'uppercase' } }}>
        {t('commons:sign_in')} {t('commons:with')}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2} py={5} alignItems="center">
          {supportedAuthProviders.map((provider) => (
            <ProviderButton key={provider} provider={provider} />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center' }}>
        <Button onClick={handleCancel}>{t('cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
};
