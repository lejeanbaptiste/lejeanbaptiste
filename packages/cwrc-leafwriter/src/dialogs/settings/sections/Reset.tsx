import { Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useActions } from '../../../overmind';
import { Button } from '../components';
import { clearCache } from '@src/db';

export const Reset = () => {
  const { resetDialogWarnings, resetPreferences } = useActions().editor;
  const { notifyViaSnackbar } = useActions().ui;
  const { t } = useTranslation('leafwriter');

  return (
    <Stack>
      <Button
        icon="reset"
        onClick={async () => {
          await resetDialogWarnings();
          notifyViaSnackbar(t('Confirmation dialog preferences have been reset').toString());
        }}
      >
        {t('Reset Dialog Warnings')}
      </Button>
      <Button
        icon="reset"
        onClick={async () => {
          await resetPreferences();
          notifyViaSnackbar(t('Settings preferences have been reset to default').toString());
        }}
      >
        {t('Reset Settings')}
      </Button>
      <Button
        icon="reset"
        onClick={async () => {
          await clearCache();
          notifyViaSnackbar(
            `${t('Cache cleared')}. ${t('You might need to reload the document')}.`,
          );
        }}
      >
        {t('Clear Cache')}
      </Button>
    </Stack>
  );
};
