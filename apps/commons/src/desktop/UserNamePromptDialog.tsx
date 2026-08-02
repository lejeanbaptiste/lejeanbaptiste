import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '@src/overmind';

/** Full dialog width; height follows the image aspect ratio so nothing is cropped. */
const SplashImage = () => (
  <Box
    component="img"
    alt=""
    src="/assets/splash/splash_new.png"
    sx={{
      display: 'block',
      width: '100%',
      height: 'auto',
    }}
  />
);

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        encoderName: string;
        encoderNameLoaded: boolean;
        setEncoderName: (name: string) => void | Promise<void>;
        pickEntityDbFolder: () => Promise<string | null>;
      };
    }
  ).__ljbCommonsUi;

/**
 * First-run gate: tagging name + entity-database folder. The folder must be
 * chosen explicitly (preferably cloud-synced); we do not treat the silent
 * app-data default as “done”.
 */
export const UserNamePromptDialog = () => {
  const { t } = useTranslation();
  const { rootPath } = useAppState().project;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [entityDbFolder, setEntityDbFolder] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    const checkOpen = () => {
      const bridge = getCommonsUiBridge();
      // Let a first-run user open an existing root before asking for a name:
      // that project may already have a portable encoder identity to inherit.
      if (!rootPath) {
        setOpen(false);
        return;
      }
      if (!bridge?.encoderNameLoaded) return;
      setOpen(!bridge.encoderName.trim());
    };
    checkOpen();
    window.addEventListener('ljbCommonsUiChanged', checkOpen);
    return () => window.removeEventListener('ljbCommonsUiChanged', checkOpen);
  }, [rootPath]);

  const handleChooseFolder = async () => {
    setChoosing(true);
    try {
      const picked = await getCommonsUiBridge()?.pickEntityDbFolder();
      if (picked) setEntityDbFolder(picked);
    } finally {
      setChoosing(false);
    }
  };

  const canFinish = Boolean(name.trim() && entityDbFolder);

  const finish = () => {
    if (!canFinish) return;
    void getCommonsUiBridge()?.setEncoderName(name.trim());
    setOpen(false);
  };

  return (
    <Dialog disableEscapeKeyDown fullWidth maxWidth="xs" open={open}>
      <SplashImage />
      <DialogTitle>{t('LWC.desktop.user_name_prompt.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Stack spacing={1}>
            <Typography variant="body2">{t('LWC.desktop.user_name_prompt.message')}</Typography>
            <TextField
              autoFocus
              fullWidth
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && canFinish) finish();
              }}
              placeholder={t('LWC.desktop.user_name_prompt.placeholder')}
              size="small"
              value={name}
            />
          </Stack>

          <Stack spacing={1}>
            <Typography variant="body2">
              {t('LWC.desktop.database_setup_prompt.message')}
            </Typography>
            <TextField
              InputProps={{ readOnly: true }}
              fullWidth
              label={t('LWC.desktop.database_setup_prompt.folder_label')}
              placeholder={t('LWC.desktop.database_setup_prompt.folder_placeholder')}
              size="small"
              value={entityDbFolder ?? ''}
            />
            <Button
              disabled={choosing}
              onClick={() => void handleChooseFolder()}
              size="small"
              variant="outlined"
            >
              {t('LWC.desktop.database_setup_prompt.choose')}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={!canFinish} onClick={finish} variant="contained">
          {t('LWC.desktop.user_name_prompt.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
