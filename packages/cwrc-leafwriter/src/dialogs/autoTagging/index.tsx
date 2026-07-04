import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  FormControlLabel,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import {
  AutoTaggingSession,
  aiApiSettingsFromDesktop,
  crawlDocuments,
  createLlmClientFromSettings,
  dictionaryTag,
  entriesFromRows,
  isAiSuggestReady,
  parseDictionaryTable,
  readSpreadsheet,
  type DictionaryEntry,
  type Suggestion,
} from '../../autoTagging';
import { AutoTaggingApplyOverlay } from '../../layout/AutoTaggingApplyOverlay';
import { useActions } from '../../overmind';
import type { IDialog } from '../type';

const SPREADSHEET_RE = /\.(xlsx|xlsm|ods)$/i;
const AI_TAG_OPTIONS = ['persName', 'placeName'] as const;
type AiTagOption = (typeof AI_TAG_OPTIONS)[number];
type DialogStep = 'methods' | 'ai';

const isDesktopApp = () => typeof window !== 'undefined' && !!window.electronAPI;

/**
 * Method chooser for auto-tagging. Produces suggestions, then hands off to the
 * docked review panel (split screen) — the editor stays visible, not greyed out.
 */
export const AutoTaggingDialog = ({ id, onClose, open = false }: IDialog) => {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<DialogStep>('methods');
  const [aiTags, setAiTags] = useState<Record<AiTagOption, boolean>>({
    persName: true,
    placeName: true,
  });
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const fileInput = useRef<HTMLInputElement>(null);
  const session = useRef<AutoTaggingSession | null>(null);
  const { startAutoTaggingReview } = useActions().ui;

  const aiSettings = aiApiSettingsFromDesktop();
  const aiReady = isAiSuggestReady(aiSettings);

  const getSession = () => {
    session.current ??= new AutoTaggingSession(window.writer);
    return session.current;
  };

  const beginReview = (produced: Suggestion[]) => {
    startAutoTaggingReview(produced);
    handleClose();
  };

  const openReview = async (parsed: DictionaryEntry[], sourceLabel: string) => {
    if (parsed.length === 0) {
      setError('No usable entries found. Expected columns: string, tag.');
      return;
    }
    const doc = await getSession().getDocument();
    const produced = dictionaryTag(doc, parsed, getSession().policy, sourceLabel);
    if (produced.length === 0) {
      setError(`No untagged matches in the document for these ${parsed.length} entries.`);
      return;
    }
    beginReview(produced);
  };

  const importList = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const entries = SPREADSHEET_RE.test(file.name)
        ? entriesFromRows(await readSpreadsheet(await file.arrayBuffer(), file.name))
        : parseDictionaryTable(await file.text());
      await openReview(entries, file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const crawlProject = async () => {
    setError(null);
    setBusy(true);
    try {
      const { documents, available } = await getSession().getProjectDocuments();
      const entries = crawlDocuments(documents, getSession().policy);
      if (entries.length === 0) {
        setError(
          available
            ? 'No tagged entities found in the project to crawl.'
            : 'No tagged entities found in this document to crawl.',
        );
        return;
      }
      await openReview(entries, available ? 'the project' : 'this document');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const openAiStep = () => {
    if (!isDesktopApp()) {
      setError('AI suggest is available in the desktop app.');
      return;
    }
    if (!aiReady) {
      setError(
        'Configure the AI API in Application Settings: set a base URL and model (and an API key for hosted providers).',
      );
      return;
    }
    setError(null);
    setStep('ai');
  };

  const runAiSuggest = async () => {
    const tags = AI_TAG_OPTIONS.filter((tag) => aiTags[tag]);
    if (tags.length === 0) {
      setError('Select at least one tag type.');
      return;
    }
    const settings = aiApiSettingsFromDesktop();
    if (!settings || !isAiSuggestReady(settings)) {
      setError('AI API is not configured.');
      return;
    }

    setError(null);
    setBusy(true);
    setAiProgress({ done: 0, total: 0 });
    try {
      const client = createLlmClientFromSettings(settings);
      const result = await getSession().runAiSuggest(tags, client, (done, total) => {
        setAiProgress({ done, total });
      });
      if (result.suggestions.length === 0) {
        setError(
          result.unverifiableCount > 0
            ? `No verifiable suggestions (${result.unverifiableCount} model claims could not be anchored in the document).`
            : 'No suggestions from the model for the selected tags.',
        );
        return;
      }
      beginReview(result.suggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setAiProgress({ done: 0, total: 0 });
    }
  };

  const handleClose = () => {
    setStep('methods');
    setError(null);
    onClose?.(id);
  };

  const methodButton = (label: string, onClick: () => void, disabled = false) => (
    <Button
      size="small"
      variant="text"
      disabled={disabled || busy}
      onClick={onClick}
      sx={{ justifyContent: 'flex-start', textTransform: 'none', px: 1, py: 0.25 }}
    >
      {label}
    </Button>
  );

  return (
    <>
      <AutoTaggingApplyOverlay
        open={busy && step === 'ai'}
        label="Running AI suggest…"
        done={aiProgress.done}
        total={aiProgress.total}
      />
      <Dialog
        open={open}
        onClose={handleClose}
        PaperProps={{ sx: { width: step === 'ai' ? 360 : 340, m: 1, borderRadius: 1 } }}
      >
        <DialogContent sx={{ p: 1.5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Auto-tagging
          </Typography>

          {error && (
            <Alert
              severity="warning"
              variant="outlined"
              onClose={() => setError(null)}
              sx={{ my: 1, py: 0, fontSize: 12 }}
            >
              {error}
            </Alert>
          )}

          {step === 'methods' ? (
            <Stack sx={{ mt: 0.5 }}>
              {methodButton('Tag from a list (CSV, TSV, xlsx, ODS)', () => fileInput.current?.click())}
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xlsm,.ods"
                hidden
                data-testid="dictionary-file-input"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importList(file);
                  event.target.value = '';
                }}
              />
              {methodButton('From existing tags in this project', () => void crawlProject())}
              {methodButton('East Asian dates', () => {}, true)}
              {methodButton('AI suggest', openAiStep, !isDesktopApp())}
              {methodButton('NER', () => {}, true)}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                <Link component="button" variant="caption" underline="hover" onClick={handleClose}>
                  Close
                </Link>
              </Box>
            </Stack>
          ) : (
            <Stack spacing={1} sx={{ mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Ask the configured model to find entity mentions. Results open in the review panel.
              </Typography>
              {aiSettings?.model && (
                <Typography variant="caption" color="text.secondary">
                  Model: {aiSettings.model}
                </Typography>
              )}
              <Stack>
                {AI_TAG_OPTIONS.map((tag) => (
                  <FormControlLabel
                    key={tag}
                    control={
                      <Checkbox
                        size="small"
                        checked={aiTags[tag]}
                        disabled={busy}
                        onChange={(event) =>
                          setAiTags((current) => ({ ...current, [tag]: event.target.checked }))
                        }
                      />
                    }
                    label={tag}
                    sx={{ ml: 0 }}
                  />
                ))}
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Link
                  component="button"
                  variant="caption"
                  underline="hover"
                  onClick={() => setStep('methods')}
                  disabled={busy}
                >
                  Back
                </Link>
                <Button size="small" variant="contained" disabled={busy} onClick={() => void runAiSuggest()}>
                  Run AI suggest
                </Button>
              </Stack>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
