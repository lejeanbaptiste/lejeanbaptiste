import { Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { clearCache } from '../../../db';
import { useActions } from '../../../overmind';
import { Button } from '../components';

export const Reset = () => {
  const { resetDialogWarnings, resetPreferences } = useActions().editor;
  const { notifyViaSnackbar } = useActions().ui;
  const { t } = useTranslation();

  return (
    <Stack direction="row" gap={2}>
      <Button
        icon="reset"
        onClick={() => {
          resetDialogWarnings().then(() => {
            notifyViaSnackbar(
              t('LW.settings.reset.message.Confirmation dialog preferences have been reset'),
            );
          });
        }}
      >
        {t('LW.settings.reset.Reset Dialog Warnings')}
      </Button>
      <Button
        icon="reset"
        onClick={() => {
          resetPreferences().then(() => {
            notifyViaSnackbar(
              t('LW.settings.reset.message.Settings preferences have been reset to default'),
            );
          });
        }}
      >
        {t('LW.settings.reset.Reset Settings')}
      </Button>
      <Button
        icon="reset"
        onClick={() => {
          clearCache().then(() => {
            notifyViaSnackbar(
              `${t('LW.settings.reset.message.Cache cleared')}. ${t('LW.settings.reset.message.You might need to reload the document')}.`,
            );
          });
        }}
      >
        {t('LW.settings.reset.Clear Cache')}
      </Button>
    </Stack>
  );
};
