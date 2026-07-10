import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  FormControlLabel,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  createDefaultAiPromptProfilesState,
  getActiveAiPromptProfile,
  persistAiPromptProfiles,
  readAiPromptProfilesFromDesktop,
  type AiPromptProfilesState,
} from '../../autoTagging/aiPromptProfiles';
import {
  aiCurationFromSettings,
  disambiguationCachingDisabledFromSettings,
  persistDisambiguationSettings,
  readPersistedDisambiguationSettings,
} from '../../autoTagging/disambiguationSettings';
import { useActions } from '../../overmind';
import type { IDialog } from '../type';
import { AiPromptEditorDialog } from '../autoTagging/AiPromptEditorDialog';

/** Disambiguation launcher — optional AI curation, preference persisted per project. */
export const DisambiguationDialog = ({ onClose, open = false }: IDialog) => {
  const { startDisambiguationReview, dismissReviewPanes } = useActions().ui;
  const [aiCuration, setAiCuration] = useState(true);
  const [disableCaching, setDisableCaching] = useState(false);
  const [aiPromptProfiles, setAiPromptProfiles] = useState<AiPromptProfilesState>(
    createDefaultAiPromptProfilesState(),
  );
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  const activePromptProfile = useMemo(
    () => getActiveAiPromptProfile(aiPromptProfiles),
    [aiPromptProfiles],
  );

  // Opening the launcher abandons any in-progress review or disambiguation
  // walk without saving — the new run starts from a clean slate.
  useEffect(() => {
    if (open) dismissReviewPanes();
  }, [open, dismissReviewPanes]);

  useEffect(() => {
    if (!open) return;
    const settings = readPersistedDisambiguationSettings();
    setAiCuration(aiCurationFromSettings(settings));
    setDisableCaching(disambiguationCachingDisabledFromSettings(settings));
    void readAiPromptProfilesFromDesktop().then(setAiPromptProfiles);
    window.setTimeout(() => startButtonRef.current?.focus(), 0);
  }, [open]);

  const handleClose = () => onClose?.();

  const handleStart = async () => {
    await persistDisambiguationSettings({ aiCuration, disableCaching });
    startDisambiguationReview({ aiCuration });
    handleClose();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void handleStart();
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        PaperProps={{ sx: { width: 380, m: 1, borderRadius: 1 } }}
      >
        <DialogContent sx={{ p: 1.5 }} onKeyDown={handleKeyDown}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Disambiguate
          </Typography>

          <Stack spacing={1} sx={{ mt: 0.5 }}>
            <Typography color="text.secondary" variant="body2">
              Link tagged mentions to authority records. With AI curation, the model pre-checks likely
              matches and explains why — you still accept each choice.
            </Typography>

            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={aiCuration}
                  onChange={(event) => setAiCuration(event.target.checked)}
                />
              }
              label="AI curation"
              sx={{ ml: 0 }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={disableCaching}
                  onChange={(event) => setDisableCaching(event.target.checked)}
                />
              }
              label="Disable caching"
              sx={{ ml: 0 }}
            />

            {aiCuration && (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="caption" color="text.secondary">
                  Prompt profile: {activePromptProfile.label}
                </Typography>
                <Link
                  component="button"
                  variant="caption"
                  underline="hover"
                  onClick={() => setPromptEditorOpen(true)}
                >
                  Edit prompt…
                </Link>
              </Stack>
            )}

            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
              <Link component="button" onClick={handleClose} underline="hover" variant="caption">
                Cancel
              </Link>
              <Button
                ref={startButtonRef}
                onClick={() => void handleStart()}
                size="small"
                variant="contained"
              >
                Start
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
      <AiPromptEditorDialog
        open={promptEditorOpen}
        state={aiPromptProfiles}
        highlightField="disambiguation"
        onClose={() => setPromptEditorOpen(false)}
        onSave={async (next) => {
          await persistAiPromptProfiles(next);
          setAiPromptProfiles(next);
        }}
      />
    </>
  );
};
