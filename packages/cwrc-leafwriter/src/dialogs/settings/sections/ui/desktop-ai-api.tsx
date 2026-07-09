import {
  Alert,
  Box,
  Button,
  Collapse,
  ListItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AiApiSettings {
  apiKey: string;
  baseUrl: string;
  customInstructions: string;
  model: string;
  temperature: number;
}

interface AiConnectionResult {
  error?: string;
  models?: string[];
  ok: boolean;
}

const DEFAULT_AI_API_SETTINGS: AiApiSettings = {
  apiKey: '',
  baseUrl: 'http://localhost:1234/v1',
  customInstructions: '',
  model: '',
  temperature: 0.1,
};

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: {
        aiApiSettings: AiApiSettings | null;
        setAiApiSettings: (settings: Partial<AiApiSettings>) => void | Promise<void>;
        testAiConnection: (settings: Partial<AiApiSettings>) => Promise<AiConnectionResult>;
      };
    }
  ).__ljbCommonsUi;

export const DesktopAiApi = () => {
  const { t } = useTranslation();
  const bridge = getCommonsUiBridge();
  const [settings, setSettings] = useState<AiApiSettings>(
    bridge?.aiApiSettings ?? DEFAULT_AI_API_SETTINGS,
  );
  const [status, setStatus] = useState<{
    message: string;
    severity: 'error' | 'info' | 'success';
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!bridge?.aiApiSettings) return;
    setSettings(bridge.aiApiSettings);
  }, [bridge?.aiApiSettings]);

  if (!bridge) return null;

  const updateSetting = <Key extends keyof AiApiSettings>(key: Key, value: AiApiSettings[Key]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setStatus(null);
  };

  const saveSettings = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await bridge.setAiApiSettings(settings);
      setStatus({ severity: 'success', message: t('LW.settings.ai_api.saved') });
    } catch (error) {
      setStatus({
        severity: 'error',
        message: error instanceof Error ? error.message : t('LW.settings.ai_api.save_failed'),
      });
    } finally {
      setSaving(false);
    }
  };

  const checkConnection = async () => {
    setChecking(true);
    setStatus({ severity: 'info', message: t('LW.settings.ai_api.checking') });
    try {
      const result = await bridge.testAiConnection(settings);
      if (!result.ok) {
        setStatus({
          severity: 'error',
          message: result.error ?? t('LW.settings.ai_api.connection_failed'),
        });
        return;
      }

      const modelCount = result.models?.length ?? 0;
      setStatus({
        severity: 'success',
        message:
          modelCount > 0
            ? t('LW.settings.ai_api.connected_with_models', { count: modelCount })
            : t('LW.settings.ai_api.connected_without_models'),
      });

      if (!settings.model && result.models?.[0]) {
        setSettings((current) => ({ ...current, model: result.models![0]! }));
      }
    } catch (error) {
      setStatus({
        severity: 'error',
        message: error instanceof Error ? error.message : t('LW.settings.ai_api.connection_failed'),
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <ListItem dense disableGutters sx={{ alignItems: 'flex-start', py: 0.25 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography color="text.secondary" sx={{ mb: 0.5 }} variant="caption">
          Configure an OpenAI-compatible endpoint for AI-assisted translation.
        </Typography>

        <Stack spacing={0.75}>
          <TextField
            fullWidth
            label={t('LW.settings.ai_api.base_url')}
            onChange={(event) => updateSetting('baseUrl', event.target.value)}
            size="small"
            value={settings.baseUrl}
          />
          <TextField
            fullWidth
            label={t('LW.settings.ai_api.api_key')}
            onChange={(event) => updateSetting('apiKey', event.target.value)}
            size="small"
            type="password"
            value={settings.apiKey}
          />
          <TextField
            fullWidth
            label={t('LW.settings.ai_api.model')}
            onChange={(event) => updateSetting('model', event.target.value)}
            size="small"
            value={settings.model}
          />
          <TextField
            fullWidth
            inputProps={{ max: 2, min: 0, step: 0.1 }}
            label={t('LW.settings.ai_api.temperature')}
            onChange={(event) => {
              const next = Number(event.target.value);
              updateSetting('temperature', Number.isFinite(next) ? next : 0.1);
            }}
            size="small"
            type="number"
            value={settings.temperature}
          />
          <TextField
            fullWidth
            label={t('LW.settings.ai_api.translation_instructions')}
            minRows={3}
            multiline
            onChange={(event) => updateSetting('customInstructions', event.target.value)}
            placeholder={t('LW.settings.ai_api.translation_instructions_placeholder')}
            size="small"
            value={settings.customInstructions}
          />

          <Collapse in={Boolean(status)}>
            {status ? (
              <Alert severity={status.severity} sx={{ py: 0 }}>
                {status.message}
              </Alert>
            ) : null}
          </Collapse>

          <Stack direction="row" spacing={1}>
            <Button
              disabled={saving}
              onClick={() => void saveSettings()}
              size="small"
              variant="contained"
            >
              {saving ? t('LW.commons.saving') : t('LW.commons.save')}
            </Button>
            <Button
              disabled={checking}
              onClick={() => void checkConnection()}
              size="small"
              variant="outlined"
            >
              {checking ? t('LW.settings.ai_api.checking_button') : t('LW.settings.ai_api.check_connection')}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </ListItem>
  );
};
