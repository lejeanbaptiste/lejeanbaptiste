import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { locales, type Locales } from '@src/i18n';
import { useActions, useAppState } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import type { PaletteMode } from '@src/types';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

export const NativeSettingsPage = () => {
  const [searchParams] = useSearchParams();
  const dialogId = searchParams.get('dialogId') ?? 'settings';
  const { t } = useTranslation();
  const { currentLocale, skipCopyPasteHelp, skipExplorerDeleteConfirm, themeAppearance } =
    useAppState().ui;
  const {
    setSkipCopyPasteHelp,
    setSkipExplorerDeleteConfirm,
    setThemeAppearance,
    switchLanguage,
  } = useActions().ui;

  const syncParent = useCallback(
    async (method: string, args?: unknown) => {
      if (!window.electronAPI?.nativeDialogInvoke) return;
      await window.electronAPI.nativeDialogInvoke({ dialogId, method, args });
    },
    [dialogId],
  );

  useEffect(() => {
    if (!isDesktop()) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void window.electronAPI?.closeNativeDialog(dialogId);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [dialogId]);

  const handleThemeChange = async (value: PaletteMode) => {
    setThemeAppearance(value);
    await syncParent('setThemeAppearance', value);
  };

  const handleLocaleChange = async (value: Locales) => {
    switchLanguage(value);
    await syncParent('setLocale', value);
  };

  const handleSkipDeleteConfirmChange = async (checked: boolean) => {
    setSkipExplorerDeleteConfirm(checked);
    await syncParent('setSkipExplorerDeleteConfirm', checked);
  };

  const handleSkipCopyPasteHelpChange = async (checked: boolean) => {
    setSkipCopyPasteHelp(checked);
    await syncParent('setSkipCopyPasteHelp', checked);
  };

  const handleClose = () => {
    void window.electronAPI?.closeNativeDialog(dialogId);
  };

  if (!isDesktop()) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>This page is only available in the desktop app.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          WebkitAppRegion: 'drag',
        }}
      >
        <Typography variant="h6">{t('LWC.desktop.settings.title')}</Typography>
      </Box>

      <Stack spacing={3} sx={{ flex: 1, p: 2, WebkitAppRegion: 'no-drag', overflow: 'auto' }}>
        <FormControl fullWidth size="small">
          <InputLabel id="native-theme-label">{t('LWC.ui.appearance')}</InputLabel>
          <Select
            labelId="native-theme-label"
            label={t('LWC.ui.appearance')}
            value={themeAppearance}
            onChange={(event) => void handleThemeChange(event.target.value as PaletteMode)}
          >
            <MenuItem value="system">{t('LWC.ui.device_theme')}</MenuItem>
            <MenuItem value="light">{t('LWC.ui.light_theme')}</MenuItem>
            <MenuItem value="dark">{t('LWC.ui.dark_theme')}</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel id="native-language-label">{t('LWC.commons.language')}</InputLabel>
          <Select
            labelId="native-language-label"
            label={t('LWC.commons.language')}
            value={currentLocale}
            onChange={(event) => void handleLocaleChange(event.target.value as Locales)}
          >
            {locales.map((locale) => (
              <MenuItem key={locale} value={locale}>
                {locale}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography variant="subtitle2">{t('LWC.desktop.settings.warnings')}</Typography>

        <FormControlLabel
          control={
            <Switch
              checked={skipExplorerDeleteConfirm}
              onChange={(event) => void handleSkipDeleteConfirmChange(event.target.checked)}
            />
          }
          label={t('LWC.desktop.settings.skip_delete_confirm')}
        />

        <FormControlLabel
          control={
            <Switch
              checked={skipCopyPasteHelp}
              onChange={(event) => void handleSkipCopyPasteHelpChange(event.target.checked)}
            />
          }
          label={t('LWC.desktop.settings.skip_copy_paste_help')}
        />

        <Typography variant="body2" color="text.secondary">
          {t('LWC.desktop.settings.editor_options_hint')}
        </Typography>
      </Stack>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', WebkitAppRegion: 'no-drag' }}>
        <Button variant="contained" onClick={handleClose}>
          Done
        </Button>
      </Box>
    </Box>
  );
};
