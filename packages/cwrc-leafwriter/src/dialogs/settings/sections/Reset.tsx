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
    <Stack>
      <Button
        icon="reset"
        onClick={async () => {
          await resetDialogWarnings();
          notifyViaSnackbar(t('LW.Confirmation dialog preferences have been reset').toString());
        }}
      >
        {t('LW.Reset Dialog Warnings')}
      </Button>
      <Button
        icon="reset"
        onClick={async () => {
          await resetPreferences();
          notifyViaSnackbar(t('LW.Settings preferences have been reset to default').toString());
        }}
      >
        {t('LW.Reset Settings')}
      </Button>
      <Button
        icon="reset"
        onClick={async () => {
          await clearCache();
          notifyViaSnackbar(
            `${t('LW.Cache cleared')}. ${t('LW.You might need to reload the document')}.`,
          );
        }}
      >
        {t('LW.Clear Cache')}
      </Button>
    </Stack>
  );
};
