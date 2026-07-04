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
        pickEntityDbFolder: () => void | Promise<void>;
      };
    }
  ).__ljbCommonsUi;

export const DesktopEntityDatabase = () => {
  const { t } = useTranslation();
  const bridge = getCommonsUiBridge();
  const [entityDbFolder, setEntityDbFolder] = useState(bridge?.entityDbFolder ?? null);

  useEffect(() => {
    if (!bridge) return;
    setEntityDbFolder(bridge.entityDbFolder);
  }, [bridge?.entityDbFolder]);

  if (!bridge) return null;

  return (
    <ListItem dense disableGutters sx={{ alignItems: 'flex-start', flexDirection: 'column', py: 0.5 }}>
      <Typography color="text.secondary" sx={{ mb: 0.75 }} variant="caption">
        {t('LWC.desktop.settings.entity_database')}
      </Typography>

      {!entityDbFolder && (
        <Alert severity="warning" sx={{ mb: 1, width: '100%' }}>
          {t('LWC.desktop.settings.entity_database_missing')}
        </Alert>
      )}

      <Stack spacing={1} sx={{ width: '100%' }}>
        <TextField
          fullWidth
          InputProps={{ readOnly: true }}
          label={t('LWC.desktop.settings.entity_database_folder')}
          size="small"
          value={entityDbFolder ?? ''}
          helperText={t('LWC.desktop.settings.entity_database_hint')}
        />
        <Box>
          <Button
            onClick={() =>
              void bridge.pickEntityDbFolder().then(() => {
                setEntityDbFolder(bridge.entityDbFolder);
              })
            }
            size="small"
            variant="outlined"
          >
            {t('LWC.desktop.settings.entity_database_change')}
          </Button>
        </Box>
      </Stack>
    </ListItem>
  );
};
