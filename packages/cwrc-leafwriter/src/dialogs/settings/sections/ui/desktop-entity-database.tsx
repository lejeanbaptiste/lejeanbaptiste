import {
  Alert,
  Box,
  Button,
  ListItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        entityDbFolder: string | null;
        pickEntityDbFolder: () => Promise<string | null>;
      };
    }
  ).__ljbCommonsUi;

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

      {!entityDbFolder && (
        <Alert severity="warning" sx={{ mb: 1, width: '100%' }}>
          {t('LW.desktop.settings.entity_database_missing')}
        </Alert>
      )}

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
            onClick={() =>
              void bridge.pickEntityDbFolder().then((folder) => {
                if (folder) setEntityDbFolder(folder);
              })
            }
            size="small"
            variant="outlined"
          >
            {t('LW.desktop.settings.entity_database_change')}
          </Button>
        </Box>
      </Stack>
    </ListItem>
  );
};
