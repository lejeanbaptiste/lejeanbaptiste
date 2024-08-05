import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material';
import { ProviderButton } from '@src/components';
import { useActions, useAppState } from '@src/overmind';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import type { IDialog } from './type';

export const SignInDialog = ({ id = uuidv4(), open = true }: IDialog) => {
  const { authProviders } = useAppState().providers;
  const { closeDialog } = useActions().ui;

  const { t } = useTranslation();

  const handleClose = (_event: MouseEvent) => closeDialog(id);
  const handleCancel = () => closeDialog(id);

  return (
    <Dialog id={id} fullWidth maxWidth="xs" onClose={handleClose} open={open}>
      <DialogTitle textAlign="center" sx={{ '::first-letter': { textTransform: 'uppercase' } }}>
        {t('LWC.commons.sign_in')} {t('LWC.commons.with')}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2} py={5} alignItems="center">
              <ProviderButton key={providerId} providerId={providerId} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center' }}>
        <Button onPointerDown={handleCancel}>{t('LWC.commons.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
};
