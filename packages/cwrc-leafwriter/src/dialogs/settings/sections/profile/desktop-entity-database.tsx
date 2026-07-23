import { Box, Button, ListItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        entityDbFolder: string | null;
        revealAuthorityLifecycleFolder: () => Promise<void>;
        moveEntityDbFolder: () => Promise<{
          ok: boolean;
          cancelled?: boolean;
          error?: string;
          folder?: string;
        }>;
        pickEntityDbFolder: () => Promise<string | null>;
      };
    }
  ).__ljbCommonsUi;

/** True store location; revealed here, relocated via Move, or swapped for an existing one via Choose. */
export const DesktopEntityDatabase = () => {
  const { t } = useTranslation();
  const bridge = getCommonsUiBridge();
  const [entityDbFolder, setEntityDbFolder] = useState(bridge?.entityDbFolder ?? null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveSuccess, setMoveSuccess] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [chooseSuccess, setChooseSuccess] = useState(false);

  useEffect(() => {
    const sync = () => setEntityDbFolder(getCommonsUiBridge()?.entityDbFolder ?? null);
    sync();
    window.addEventListener('ljbCommonsUiChanged', sync);
    return () => window.removeEventListener('ljbCommonsUiChanged', sync);
  }, []);

  if (!bridge) return null;

  const handleMove = async () => {
    setMoveError(null);
    setMoveSuccess(false);
    setChooseSuccess(false);
    setMoving(true);
    try {
      const result = await bridge.moveEntityDbFolder();
      if (result.ok) {
        setMoveSuccess(true);
      } else if (!result.cancelled && result.error) {
        setMoveError(result.error);
      }
    } finally {
      setMoving(false);
    }
  };

  const handleChoose = async () => {
    setMoveError(null);
    setMoveSuccess(false);
    setChooseSuccess(false);
    setChoosing(true);
    try {
      const picked = await bridge.pickEntityDbFolder();
      if (picked) {
        setEntityDbFolder(picked);
        setChooseSuccess(true);
      }
    } finally {
      setChoosing(false);
    }
  };

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
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            onClick={() => void bridge.revealAuthorityLifecycleFolder()}
            size="small"
            variant="outlined"
          >
            {t('LW.desktop.settings.entity_database_reveal')}
          </Button>
          <Button
            disabled={moving}
            onClick={() => void handleMove()}
            size="small"
            variant="outlined"
          >
            {t('LW.desktop.settings.entity_database_move')}
          </Button>
          <Button
            disabled={choosing}
            onClick={() => void handleChoose()}
            size="small"
            variant="outlined"
          >
            {t('LW.desktop.settings.entity_database_change')}
          </Button>
        </Box>
        <Typography color="text.secondary" variant="caption" component="p">
          {t('LW.desktop.settings.entity_database_move_hint')}
        </Typography>
        <Typography color="text.secondary" variant="caption" component="p">
          {t('LW.desktop.settings.entity_database_change_hint')}
        </Typography>
        {moveSuccess && (
          <Typography color="success.main" variant="caption" component="p">
            {t('LW.desktop.settings.entity_database_move_success')}
          </Typography>
        )}
        {chooseSuccess && (
          <Typography color="success.main" variant="caption" component="p">
            {t('LW.desktop.settings.entity_database_change_success')}
          </Typography>
        )}
        {moveError && (
          <Typography color="error" variant="caption" component="p">
            {moveError}
          </Typography>
        )}
      </Stack>
    </ListItem>
  );
};
