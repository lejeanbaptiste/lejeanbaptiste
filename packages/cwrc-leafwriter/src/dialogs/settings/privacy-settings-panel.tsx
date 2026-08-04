import { Alert, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export const PrivacySettingsPanel = () => {
  const { t } = useTranslation();

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
    </Stack>
  );
};
