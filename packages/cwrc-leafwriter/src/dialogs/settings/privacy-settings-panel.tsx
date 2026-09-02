import { Alert, Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSettingsNavigation } from './settingsNavigationContext';
import type { SettingsTabId } from './types';

export const PrivacySettingsPanel = () => {
  const { t } = useTranslation();
  const navigate = useSettingsNavigation();

  const goTo = (tab: SettingsTabId) => {
    navigate?.(tab);
  };

  return (
    <Stack spacing={1.5}>
      <Typography color="text.secondary" variant="body2">
        {t('LW.settings.privacy.summary')}
      </Typography>

      <Alert severity="info">{t('LW.settings.privacy.local_first')}</Alert>

      <Stack spacing={0.75}>
        <Typography variant="subtitle2">{t('LW.settings.privacy.documents_title')}</Typography>
        <Typography color="text.secondary" variant="body2">
          {t('LW.settings.privacy.documents_body')}
        </Typography>
      </Stack>

      <Stack spacing={0.75}>
        <Typography variant="subtitle2">{t('LW.settings.privacy.leaderboard_title')}</Typography>
        <Typography color="text.secondary" variant="body2">
          {t('LW.settings.privacy.leaderboard_body')}
        </Typography>
      </Stack>

      <Stack spacing={0.75}>
        <Typography variant="subtitle2">{t('LW.settings.privacy.telemetry_title')}</Typography>
        <Typography color="text.secondary" variant="body2">
          {t('LW.settings.privacy.telemetry_body')}
        </Typography>
      </Stack>

      <Stack spacing={0.75}>
        <Typography variant="subtitle2">{t('LW.settings.privacy.web_title')}</Typography>
        <Typography color="text.secondary" variant="body2">
          {t('LW.settings.privacy.web_body')}
        </Typography>
      </Stack>

      {navigate && (
        <Stack spacing={0.75} sx={{ pt: 0.5 }}>
          <Typography variant="subtitle2">{t('LW.settings.privacy.configure_title')}</Typography>
          <Stack alignItems="flex-start" spacing={0.25}>
            <Button onClick={() => goTo('profile')} size="small" sx={{ textAlign: 'left' }}>
              {t('LW.settings.privacy.goto_profile_github')}
            </Button>
            <Button onClick={() => goTo('entity-database')} size="small" sx={{ textAlign: 'left' }}>
              {t('LW.settings.privacy.goto_entity_database')}
            </Button>
            <Button onClick={() => goTo('ai')} size="small" sx={{ textAlign: 'left' }}>
              {t('LW.settings.privacy.goto_ai')}
            </Button>
            <Button onClick={() => goTo('interface')} size="small" sx={{ textAlign: 'left' }}>
              {t('LW.settings.privacy.goto_proofreading')}
            </Button>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
};
