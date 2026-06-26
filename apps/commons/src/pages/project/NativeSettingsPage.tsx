import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { locales, type Locales } from '@src/i18n';
import { isDesktop } from '@src/types/desktop';
import type { PaletteMode } from '@src/types';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

interface InterfaceSettings {
  currentLocale: Locales;
  themeAppearance: PaletteMode;
}

export const NativeSettingsPage = () => {
  const [searchParams] = useSearchParams();
  const dialogId = searchParams.get('dialogId') ?? 'settings';
  const [settings, setSettings] = useState<InterfaceSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const invoke = useCallback(
    async (method: string, args?: unknown) => {
      return window.electronAPI?.nativeDialogInvoke({ dialogId, method, args });
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

  useEffect(() => {
    if (!isDesktop()) return;

    void (async () => {
      const state = (await invoke('getInterfaceSettings')) as InterfaceSettings | null;
      if (state) setSettings(state);
      setLoading(false);
    })();
  }, [dialogId, invoke]);

  const handleThemeChange = async (value: PaletteMode) => {
    setSettings((current) => (current ? { ...current, themeAppearance: value } : current));
    await invoke('setThemeAppearance', value);
  };

  const handleLocaleChange = async (value: Locales) => {
    setSettings((current) => (current ? { ...current, currentLocale: value } : current));
    await invoke('setLocale', value);
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
        <Typography variant="h6">Settings</Typography>
      </Box>

      <Stack spacing={3} sx={{ flex: 1, p: 2, WebkitAppRegion: 'no-drag' }}>
        {loading || !settings ? (
          <Typography color="text.secondary">Loading…</Typography>
        ) : (
          <>
            <FormControl fullWidth size="small">
              <InputLabel id="native-theme-label">Appearance</InputLabel>
              <Select
                labelId="native-theme-label"
                label="Appearance"
                value={settings.themeAppearance}
                onChange={(event) => void handleThemeChange(event.target.value as PaletteMode)}
              >
                <MenuItem value="system">System</MenuItem>
                <MenuItem value="light">Light</MenuItem>
                <MenuItem value="dark">Dark</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel id="native-language-label">Language</InputLabel>
              <Select
                labelId="native-language-label"
                label="Language"
                value={settings.currentLocale}
                onChange={(event) => void handleLocaleChange(event.target.value as Locales)}
              >
                {locales.map((locale) => (
                  <MenuItem key={locale} value={locale}>
                    {locale}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="body2" color="text.secondary">
              Schema, authorities, and other editor options are available from the ⚙ toolbar
              while a document is open.
            </Typography>
          </>
        )}
      </Stack>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', WebkitAppRegion: 'no-drag' }}>
        <Button variant="contained" onClick={handleClose}>
          Done
        </Button>
      </Box>
    </Box>
  );
};
