import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
  DEFAULT_AI_PROMPT_PROFILE_ID,
  addNamedProfile,
  deleteAiPromptProfile,
  getActiveAiPromptProfile,
  revertProfileToDefaults,
  saveProfileEdits,
  setActiveAiPromptProfile,
  type AiPromptProfile,
  type AiPromptProfilesState,
} from '../../autoTagging/aiPromptProfiles';

interface AiPromptEditorDialogProps {
  open: boolean;
  state: AiPromptProfilesState;
  onClose: () => void;
  onSave: (next: AiPromptProfilesState) => void | Promise<void>;
}

export function AiPromptEditorDialog({ open, state, onClose, onSave }: AiPromptEditorDialogProps) {
  const activeProfile = getActiveAiPromptProfile(state);
  const [profileId, setProfileId] = useState(activeProfile.id);
  const [label, setLabel] = useState(activeProfile.label);
  const [suggestTaskText, setSuggestTaskText] = useState(activeProfile.suggestTaskText);
  const [auditCleanTaskText, setAuditCleanTaskText] = useState(activeProfile.auditCleanTaskText);
  const [newProfileName, setNewProfileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedProfile =
    state.profiles.find((p) => p.id === profileId) ?? activeProfile;

  useEffect(() => {
    if (!open) return;
    const profile = getActiveAiPromptProfile(state);
    setProfileId(profile.id);
    setLabel(profile.label);
    setSuggestTaskText(profile.suggestTaskText);
    setAuditCleanTaskText(profile.auditCleanTaskText);
    setNewProfileName('');
    setError(null);
  }, [open, state]);

  const loadProfileIntoEditor = (profile: AiPromptProfile) => {
    setProfileId(profile.id);
    setLabel(profile.label);
    setSuggestTaskText(profile.suggestTaskText);
    setAuditCleanTaskText(profile.auditCleanTaskText);
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
    setBusy(true);
    try {
      let next = setActiveAiPromptProfile(state, profileId);
      next = saveProfileEdits(next, profileId, {
        label: label.trim() || selectedProfile.label,
        suggestTaskText,
        auditCleanTaskText,
      });
      await onSave(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRevert = () => {
    const reverted = revertProfileToDefaults(selectedProfile);
    setSuggestTaskText(reverted.suggestTaskText);
    setAuditCleanTaskText(reverted.auditCleanTaskText);
    setError(null);
  };

  const handleSaveAsNew = async () => {
    const trimmed = newProfileName.trim();
    if (!trimmed) {
      setError('Enter a name for the new profile.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      let next = saveProfileEdits(state, profileId, {
        label: label.trim() || selectedProfile.label,
        suggestTaskText,
        auditCleanTaskText,
      });
      next = addNamedProfile(next, trimmed, {
        ...selectedProfile,
        label: trimmed,
        suggestTaskText,
        auditCleanTaskText,
      });
      await onSave(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (profileId === DEFAULT_AI_PROMPT_PROFILE_ID) return;
    setError(null);
    setBusy(true);
    try {
      const next = deleteAiPromptProfile(state, profileId);
      await onSave(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit AI prompts</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Edit task wording for suggest and audit. Locator rules, chunk boundaries, tag
            definitions, and JSON shape stay locked in the app.
          </Typography>

          {error && (
            <Alert severity="warning" variant="outlined" sx={{ py: 0.5 }}>
              {error}
            </Alert>
          )}

          <FormControl size="small" fullWidth>
            <InputLabel id="ai-prompt-profile-label">Profile</InputLabel>
            <Select
              labelId="ai-prompt-profile-label"
              label="Profile"
              value={profileId}
              disabled={busy}
              onChange={(event) => {
                const next = state.profiles.find((p) => p.id === event.target.value);
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
              label="Profile label"
              value={label}
              disabled={busy}
              onChange={(event) => setLabel(event.target.value)}
            />
          )}

          <TextField
            label="Suggest task text"
            value={suggestTaskText}
            disabled={busy}
            onChange={(event) => setSuggestTaskText(event.target.value)}
            multiline
            minRows={6}
            fullWidth
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: 12 } }}
          />

          <TextField
            label="Audit clean task text"
            value={auditCleanTaskText}
            disabled={busy}
            onChange={(event) => setAuditCleanTaskText(event.target.value)}
            multiline
            minRows={6}
            fullWidth
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: 12 } }}
          />

          <Box>
            <TextField
              size="small"
              label="Save as new profile"
              value={newProfileName}
              disabled={busy}
              onChange={(event) => setNewProfileName(event.target.value)}
              placeholder="Groq classical biography"
              fullWidth
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        {profileId !== DEFAULT_AI_PROMPT_PROFILE_ID && (
          <Button color="error" disabled={busy} onClick={() => void handleDelete()}>
            Delete profile
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button disabled={busy} onClick={handleRevert}>
          Revert to default text
        </Button>
        <Button disabled={busy || !newProfileName.trim()} onClick={() => void handleSaveAsNew()}>
          Save as new…
        </Button>
        <Button disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" disabled={busy} onClick={() => void handleSave()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
