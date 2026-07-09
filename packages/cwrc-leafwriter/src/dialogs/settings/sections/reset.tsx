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
              notifyViaSnackbar(t('LW.settings.reset.message.dialog_warnings_reset'));
            });
          }}
        >
        {t('LW.settings.reset.reset_dialog_warnings')}
      </Button>
      <Button
        icon="reset"
        onClick={() => {
            resetPreferences().then(() => {
              notifyViaSnackbar(t('LW.settings.reset.message.settings_reset_to_default'));
            });
          }}
        >
        {t('LW.settings.reset.reset_settings')}
      </Button>
      <Button
        icon="reset"
        onClick={() => {
            clearCache().then(() => {
              notifyViaSnackbar(
                `${t('LW.settings.reset.message.cache_cleared')}. ${t(
                  'LW.settings.reset.message.reload_document_if_needed',
                )}.`,
              );
            });
          }}
        >
        {t('LW.settings.reset.clear_cache')}
      </Button>
    </Stack>
  );
};
