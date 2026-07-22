import {
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

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        encoderName: string;
        encoderNameLoaded: boolean;
        setEncoderName: (name: string) => void | Promise<void>;
      };
    }
  ).__ljbCommonsUi;

/**
 * Minimal, standalone gate for the one thing that must be set before
 * tagging: a name to attribute the work to in document metadata. Deliberately
 * not the full Settings dialog - see openApplicationSettingsAndWait for the
 * heavier version used elsewhere.
 */
export const UserNamePromptDialog = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    const checkOpen = () => {
      const bridge = getCommonsUiBridge();
      if (bridge?.encoderNameLoaded && !bridge.encoderName.trim()) setOpen(true);
    };
    checkOpen();
    window.addEventListener('ljbCommonsUiChanged', checkOpen);
    return () => window.removeEventListener('ljbCommonsUiChanged', checkOpen);
  }, []);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    void getCommonsUiBridge()?.setEncoderName(trimmed);
    setOpen(false);
  };

  return (
    <Dialog disableEscapeKeyDown fullWidth maxWidth="xs" open={open}>
      <DialogTitle>{t('LWC.desktop.user_name_prompt.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Typography variant="body2">{t('LWC.desktop.user_name_prompt.message')}</Typography>
          <TextField
            autoFocus
            fullWidth
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSave();
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
        <Button disabled={!name.trim()} onClick={handleSave} variant="contained">
          {t('LWC.desktop.user_name_prompt.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
