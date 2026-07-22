import { Box, Button, ListItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        achievementsFolder: string | null;
        pickAchievementsFolder: () => Promise<{ folder: string; warning?: string } | null>;
        importAchievementsFrom: () => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
      };
    }
  ).__ljbCommonsUi;

export const DesktopAchievementsStorage = () => {
  const { t } = useTranslation();
  const bridge = getCommonsUiBridge();
  const [achievementsFolder, setAchievementsFolder] = useState(bridge?.achievementsFolder ?? null);
  const [importError, setImportError] = useState<string | null>(null);
  const [folderWarning, setFolderWarning] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setAchievementsFolder(getCommonsUiBridge()?.achievementsFolder ?? null);
    sync();
    window.addEventListener('ljbCommonsUiChanged', sync);
    return () => window.removeEventListener('ljbCommonsUiChanged', sync);
  }, []);

  if (!bridge) return null;

  const handleChooseFolder = async () => {
    setFolderWarning(null);
    const picked = await bridge.pickAchievementsFolder();
    if (picked) {
      setAchievementsFolder(picked.folder);
      if (picked.warning) setFolderWarning(picked.warning);
    }
  };

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
        <TextField
          fullWidth
          InputProps={{ readOnly: true }}
          label={t('LW.desktop.settings.achievements_storage_folder')}
          size="small"
          value={achievementsFolder ?? t('LW.desktop.settings.achievements_storage_default')}
          helperText={t('LW.desktop.settings.achievements_storage_hint')}
        />
        <Box>
          <Button onClick={() => void handleChooseFolder()} size="small" variant="outlined">
            {t('LW.desktop.settings.achievements_storage_change')}
          </Button>
          {folderWarning && (
            <Typography color="warning.main" sx={{ mt: 0.5 }} variant="caption" component="p">
              {folderWarning}
            </Typography>
          )}
        </Box>

        <Box sx={{ pt: 1 }}>
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
