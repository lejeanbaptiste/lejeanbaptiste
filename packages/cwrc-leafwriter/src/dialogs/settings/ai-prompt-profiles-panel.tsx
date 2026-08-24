import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_AI_PROMPT_PROFILE_ID,
  addNamedProfile,
  deleteAiPromptProfile,
  getActiveAiPromptProfile,
  persistAiPromptProfiles,
  readAiPromptProfilesFromDesktop,
  revertProfileToDefaults,
  saveProfileEdits,
  setActiveAiPromptProfile,
  type AiPromptProfile,
  type AiPromptProfilesState,
} from '../../autoTagging/aiPromptProfiles';

export const AiPromptProfilesPanel = ({ active = true }: { active?: boolean }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<AiPromptProfilesState | null>(null);
  const [profileId, setProfileId] = useState(DEFAULT_AI_PROMPT_PROFILE_ID);
  const [label, setLabel] = useState('');
  const [suggestTaskText, setSuggestTaskText] = useState('');
  const [auditCleanTaskText, setAuditCleanTaskText] = useState('');
  const [disambiguationRankTaskText, setDisambiguationRankTaskText] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const disambiguationFieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    void readAiPromptProfilesFromDesktop().then((next) => {
      setState(next);
      const profile = getActiveAiPromptProfile(next);
      setProfileId(profile.id);
      setLabel(profile.label);
      setSuggestTaskText(profile.suggestTaskText);
      setAuditCleanTaskText(profile.auditCleanTaskText);
      setDisambiguationRankTaskText(profile.disambiguationRankTaskText);
    });
  }, [active]);

  const selectedProfile =
    state?.profiles.find((profile) => profile.id === profileId) ??
    (state ? getActiveAiPromptProfile(state) : null);

  const loadProfileIntoEditor = (profile: AiPromptProfile) => {
    setProfileId(profile.id);
    setLabel(profile.label);
    setSuggestTaskText(profile.suggestTaskText);
    setAuditCleanTaskText(profile.auditCleanTaskText);
    setDisambiguationRankTaskText(profile.disambiguationRankTaskText);
    setError(null);
  };

  const profileEdits = () => ({
    label: label.trim() || selectedProfile?.label || '',
    suggestTaskText,
    auditCleanTaskText,
    disambiguationRankTaskText,
  });

  const saveState = async (next: AiPromptProfilesState) => {
    await persistAiPromptProfiles(next);
    setState(next);
    const profile = getActiveAiPromptProfile(next);
    loadProfileIntoEditor(profile);
    setNewProfileName('');
  };

  const handleSave = async () => {
    if (!state) return;
    setError(null);
    setBusy(true);
    try {
      let next = setActiveAiPromptProfile(state, profileId);
      next = saveProfileEdits(next, profileId, profileEdits());
      await saveState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRevert = () => {
    if (!selectedProfile) return;
    const reverted = revertProfileToDefaults(selectedProfile);
    setSuggestTaskText(reverted.suggestTaskText);
    setAuditCleanTaskText(reverted.auditCleanTaskText);
    setDisambiguationRankTaskText(reverted.disambiguationRankTaskText);
    setError(null);
    window.setTimeout(
      () => disambiguationFieldRef.current?.scrollIntoView({ block: 'nearest' }),
      0,
    );
  };

  const handleSaveAsNew = async () => {
    if (!state || !selectedProfile) return;
    const trimmed = newProfileName.trim();
    if (!trimmed) {
      setError(t('LW.settings.ai_prompts.enter_new_profile_name'));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      let next = saveProfileEdits(state, profileId, profileEdits());
      const editedProfile = {
        ...selectedProfile,
        ...profileEdits(),
        label: trimmed,
      };
      next = addNamedProfile(next, trimmed, editedProfile);
      await saveState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!state || profileId === DEFAULT_AI_PROMPT_PROFILE_ID) return;
    setError(null);
    setBusy(true);
    try {
      const next = deleteAiPromptProfile(state, profileId);
      await saveState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return (
      <Typography color="text.secondary" variant="body2">
        {t('LW.commons.loading')}
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5} sx={{ mt: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {t('LW.settings.ai_prompts.description')}
      </Typography>

      {error && (
        <Alert severity="warning" variant="outlined" sx={{ py: 0.5 }}>
          {error}
        </Alert>
      )}

      <FormControl size="small" fullWidth>
        <InputLabel id="ai-prompt-profile-label">{t('LW.settings.ai_prompts.profile')}</InputLabel>
        <Select
          labelId="ai-prompt-profile-label"
          label={t('LW.settings.ai_prompts.profile')}
          value={profileId}
          disabled={busy}
          onChange={(event) => {
            const next = state.profiles.find((profile) => profile.id === event.target.value);
            if (next) loadProfileIntoEditor(next);
          }}
        >
          {state.profiles.map((profile) => (
            <MenuItem key={profile.id} value={profile.id}>
              {profile.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {profileId !== DEFAULT_AI_PROMPT_PROFILE_ID && (
        <TextField
          size="small"
          label={t('LW.settings.ai_prompts.profile_label')}
          value={label}
          disabled={busy}
          onChange={(event) => setLabel(event.target.value)}
        />
      )}

      <TextField
        label={t('LW.settings.ai_prompts.suggest_task_text')}
        value={suggestTaskText}
        disabled={busy}
        onChange={(event) => setSuggestTaskText(event.target.value)}
        multiline
        minRows={5}
        fullWidth
        InputProps={{ sx: { fontFamily: 'monospace', fontSize: 12 } }}
      />

      <TextField
        label={t('LW.settings.ai_prompts.audit_clean_task_text')}
        value={auditCleanTaskText}
        disabled={busy}
        onChange={(event) => setAuditCleanTaskText(event.target.value)}
        multiline
        minRows={5}
        fullWidth
        InputProps={{ sx: { fontFamily: 'monospace', fontSize: 12 } }}
      />

      <Box ref={disambiguationFieldRef}>
        <TextField
          label={t('LW.settings.ai_prompts.disambiguation_rank_task_text')}
          value={disambiguationRankTaskText}
          disabled={busy}
          onChange={(event) => setDisambiguationRankTaskText(event.target.value)}
          multiline
          minRows={5}
          fullWidth
          InputProps={{ sx: { fontFamily: 'monospace', fontSize: 12 } }}
        />
      </Box>

      <TextField
        size="small"
        label={t('LW.settings.ai_prompts.save_as_new_profile')}
        value={newProfileName}
        disabled={busy}
        onChange={(event) => setNewProfileName(event.target.value)}
        placeholder={t('LW.settings.ai_prompts.new_profile_placeholder')}
        fullWidth
      />

      <Stack direction="row" flexWrap="wrap" gap={1}>
        {profileId !== DEFAULT_AI_PROMPT_PROFILE_ID && (
          <Button color="error" disabled={busy} onClick={() => void handleDelete()}>
            {t('LW.settings.ai_prompts.delete_profile')}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button disabled={busy} onClick={handleRevert}>
          {t('LW.settings.ai_prompts.revert_to_default_text')}
        </Button>
        <Button disabled={busy || !newProfileName.trim()} onClick={() => void handleSaveAsNew()}>
          {t('LW.settings.ai_prompts.save_as_new')}
        </Button>
        <Button variant="contained" disabled={busy} onClick={() => void handleSave()}>
          {t('LW.commons.save')}
        </Button>
      </Stack>
    </Stack>
  );
};
