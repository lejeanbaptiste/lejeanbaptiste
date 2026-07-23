import { Box, ListItem, Stack, Typography, Button } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        importAchievementsFrom: () => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
      };
    }
  ).__ljbCommonsUi;

/** Stats travel with the entity database folder automatically; no separate location to configure. */
export const DesktopAchievementsStorage = () => {
  const { t } = useTranslation();
  const bridge = getCommonsUiBridge();
  const [importError, setImportError] = useState<string | null>(null);

  if (!bridge) return null;

  const handleImport = async () => {
    setImportError(null);
    const result = await bridge.importAchievementsFrom();
    if (!result.ok && result.error) setImportError(result.error);
  };

  return (
    <ListItem dense disableGutters sx={{ alignItems: 'flex-start', flexDirection: 'column', py: 0.5 }}>
      <Typography color="text.secondary" sx={{ mb: 0.75 }} variant="caption">
        {t('LW.desktop.settings.achievements_storage')}
      </Typography>

      <Stack spacing={1} sx={{ width: '100%' }}>
        <Typography color="text.secondary" variant="caption" component="p">
          {t('LW.desktop.settings.achievements_storage_hint')}
        </Typography>

        <Box>
          <Button onClick={() => void handleImport()} size="small" variant="outlined" color="warning">
            {t('LW.desktop.settings.achievements_import')}
          </Button>
          <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="caption" component="p">
            {t('LW.desktop.settings.achievements_import_hint')}
          </Typography>
          {importError && (
            <Typography color="error" sx={{ mt: 0.5 }} variant="caption" component="p">
              {importError}
            </Typography>
          )}
        </Box>
      </Stack>
    </ListItem>
  );
};
