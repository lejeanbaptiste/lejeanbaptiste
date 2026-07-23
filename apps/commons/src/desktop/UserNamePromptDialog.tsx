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

const SplashImage = () => (
  <Box
    component="img"
    alt=""
    src="/assets/splash/splash_new.png"
    sx={{
      display: 'block',
      width: '100%',
      height: 160,
      objectFit: 'cover',
      objectPosition: 'center 30%',
      borderTopLeftRadius: 'inherit',
      borderTopRightRadius: 'inherit',
    }}
  />
);

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        encoderName: string;
        encoderNameLoaded: boolean;
        entityDbFolder: string | null;
        setEncoderName: (name: string) => void | Promise<void>;
        pickEntityDbFolder: () => Promise<string | null>;
      };
    }
  ).__ljbCommonsUi;

type Step = 'name' | 'database';

/**
 * Minimal, standalone first-run gate for the two things that must be set
 * before tagging: a name to attribute the work to, and where the entity
 * database lives (so a synced/shared database can be adopted up front
 * instead of the app silently creating its own). Deliberately not the full
 * Settings dialog - see openApplicationSettingsAndWait for the heavier
 * version used elsewhere.
 */
export const UserNamePromptDialog = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [entityDbFolder, setEntityDbFolder] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    const checkOpen = () => {
      const bridge = getCommonsUiBridge();
      if (bridge?.encoderNameLoaded && !bridge.encoderName.trim()) setOpen(true);
      setEntityDbFolder(bridge?.entityDbFolder ?? null);
    };
    checkOpen();
    window.addEventListener('ljbCommonsUiChanged', checkOpen);
    return () => window.removeEventListener('ljbCommonsUiChanged', checkOpen);
  }, []);

  const handleNameNext = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStep('database');
  };

  const finish = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    void getCommonsUiBridge()?.setEncoderName(trimmed);
    setOpen(false);
    setStep('name');
  };

  const handleChooseFolder = async () => {
    setChoosing(true);
    try {
      const picked = await getCommonsUiBridge()?.pickEntityDbFolder();
      if (picked) setEntityDbFolder(picked);
    } finally {
      setChoosing(false);
    }
  };

  if (step === 'database') {
    return (
      <Dialog disableEscapeKeyDown fullWidth maxWidth="xs" open={open}>
        <SplashImage />
        <DialogTitle>{t('LWC.desktop.database_setup_prompt.title')}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Typography variant="body2">{t('LWC.desktop.database_setup_prompt.message')}</Typography>
            <TextField
              InputProps={{ readOnly: true }}
              fullWidth
              label={t('LWC.desktop.database_setup_prompt.folder_label')}
              size="small"
              value={entityDbFolder ?? ''}
            />
            <Button disabled={choosing} onClick={() => void handleChooseFolder()} size="small" variant="outlined">
              {t('LWC.desktop.database_setup_prompt.choose')}
            </Button>
            <Typography color="text.secondary" variant="caption">
              {t('LWC.desktop.database_setup_prompt.note')}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={finish} variant="contained">
            {t('LWC.desktop.database_setup_prompt.done')}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog disableEscapeKeyDown fullWidth maxWidth="xs" open={open}>
      <SplashImage />
      <DialogTitle>{t('LWC.desktop.user_name_prompt.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Typography variant="body2">{t('LWC.desktop.user_name_prompt.message')}</Typography>
          <TextField
            autoFocus
            fullWidth
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleNameNext();
            }}
            placeholder={t('LWC.desktop.user_name_prompt.placeholder')}
            size="small"
            value={name}
          />
          <Typography color="text.secondary" variant="caption">
            {t('LWC.desktop.user_name_prompt.note')}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={!name.trim()} onClick={handleNameNext} variant="contained">
          {t('LWC.desktop.user_name_prompt.next')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
