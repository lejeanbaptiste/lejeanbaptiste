import { Box, Button, ListItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        entityDbFolder: string | null;
        revealAuthorityLifecycleFolder: () => Promise<void>;
      };
    }
  ).__ljbCommonsUi;

/** True store location; only revealed here, never re-picked (see auto-tagging dialog for that). */
export const DesktopEntityDatabase = () => {
  const { t } = useTranslation();
  const bridge = getCommonsUiBridge();
  const [entityDbFolder, setEntityDbFolder] = useState(bridge?.entityDbFolder ?? null);

  useEffect(() => {
    const sync = () => setEntityDbFolder(getCommonsUiBridge()?.entityDbFolder ?? null);
    sync();
    window.addEventListener('ljbCommonsUiChanged', sync);
    return () => window.removeEventListener('ljbCommonsUiChanged', sync);
  }, []);

  if (!bridge) return null;

  return (
    <ListItem dense disableGutters sx={{ alignItems: 'flex-start', flexDirection: 'column', py: 0.5 }}>
      <Typography color="text.secondary" sx={{ mb: 0.75 }} variant="caption">
        {t('LW.desktop.settings.entity_database')}
      </Typography>

      <Stack spacing={1} sx={{ width: '100%' }}>
        <TextField
          fullWidth
          InputProps={{ readOnly: true }}
          label={t('LW.desktop.settings.entity_database_folder')}
          size="small"
          value={entityDbFolder ?? ''}
          helperText={t('LW.desktop.settings.entity_database_hint')}
        />
        <Box>
          <Button
            onClick={() => void bridge.revealAuthorityLifecycleFolder()}
            size="small"
            variant="outlined"
          >
            {t('LW.desktop.settings.entity_database_reveal')}
          </Button>
        </Box>
      </Stack>
    </ListItem>
  );
};
