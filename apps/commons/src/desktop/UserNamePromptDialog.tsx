import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ensureEntityDbFolder } from './entityDbOnboarding';

/** Same localStorage key as Leaf-Writer Guardrails → `setEnableXmlEditing`. */
const ENABLE_XML_EDITING_KEY = 'enableXmlEditing';

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
        entityDbFolder: string | null;
        setEncoderName: (name: string) => void | Promise<void>;
        pickEntityDbFolder: () => Promise<string | null>;
      };
    }
  ).__ljbCommonsUi;

/** Prefer the live editor preference; fall back to localStorage (default on). */
const readEnableXmlEditing = (): boolean => {
  const fromWriter = window.writer?.overmindState?.editor?.enableXmlEditing;
  if (typeof fromWriter === 'boolean') return fromWriter;
  try {
    const raw = localStorage.getItem(ENABLE_XML_EDITING_KEY);
    if (raw === null) return true;
    return JSON.parse(raw) as boolean;
  } catch {
    return true;
  }
};

/**
 * Persist via the editor action when ready; otherwise write localStorage so
 * editor init picks the choice up, and notify the desktop shell.
 */
const writeEnableXmlEditing = (value: boolean) => {
  const set = window.writer?.overmindActions?.editor?.setEnableXmlEditing as
    ((next: boolean) => void) | undefined;
  if (set) {
    set(value);
    return;
  }
  localStorage.setItem(ENABLE_XML_EDITING_KEY, JSON.stringify(value));
  window.dispatchEvent(
    new CustomEvent('leafwriter:enable-xml-editing-change', { detail: { value } }),
  );
};

/**
 * First-run gate: tagging name only. A default entity-database folder deep in
 * app data is already assigned; choosing a cloud-synced folder is optional.
 */
export const UserNamePromptDialog = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [entityDbFolder, setEntityDbFolder] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [enableXmlEditing, setEnableXmlEditing] = useState(readEnableXmlEditing);

  useEffect(() => {
    const checkOpen = () => {
      const bridge = getCommonsUiBridge();
      // Rule: no user name → splash. Wait until prefs have loaded so we do not
      // flash the dialog before a saved name is read from disk.
      if (!bridge?.encoderNameLoaded) return;
      setOpen(!bridge.encoderName.trim());
      if (bridge.entityDbFolder) setEntityDbFolder(bridge.entityDbFolder);
    };
    checkOpen();
    window.addEventListener('grognardCommonsUiChanged', checkOpen);
    return () => window.removeEventListener('grognardCommonsUiChanged', checkOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    setEnableXmlEditing(readEnableXmlEditing());
    // Make sure the silent default folder actually contains a database, so
    // finishing with no explicit pick still leaves tagging ready to use.
    void ensureEntityDbFolder().then(() => {
      const folder = getCommonsUiBridge()?.entityDbFolder;
      if (folder) setEntityDbFolder(folder);
    });
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ value: boolean }>).detail;
      setEnableXmlEditing(detail.value);
    };
    window.addEventListener('leafwriter:enable-xml-editing-change', handler);
    return () => window.removeEventListener('leafwriter:enable-xml-editing-change', handler);
  }, [open]);

  const handleChooseFolder = async () => {
    setChoosing(true);
    try {
      const picked = await getCommonsUiBridge()?.pickEntityDbFolder();
      if (picked) setEntityDbFolder(picked);
    } finally {
      setChoosing(false);
    }
  };

  const handleEnableXmlEditingChange = (checked: boolean) => {
    setEnableXmlEditing(checked);
    writeEnableXmlEditing(checked);
  };

  const canFinish = Boolean(name.trim());

  const finish = () => {
    if (!canFinish) return;
    // Re-apply in case the editor became ready after the user toggled.
    writeEnableXmlEditing(enableXmlEditing);
    void ensureEntityDbFolder();
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
            <Typography color="text.secondary" variant="caption">
              {t('LWC.desktop.database_setup_prompt.note')}
            </Typography>
            <Button
              disabled={choosing}
              onClick={() => void handleChooseFolder()}
              size="small"
              variant="outlined"
            >
              {t('LWC.desktop.database_setup_prompt.choose')}
            </Button>
          </Stack>

          <FormControlLabel
            control={
              <Switch
                checked={enableXmlEditing}
                onChange={(event) => handleEnableXmlEditingChange(event.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2">
                {t('LWC.desktop.user_name_prompt.enable_xml_editing')}
              </Typography>
            }
          />
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
