import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  FormControlLabel,
  Link,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AutoTaggingSession,
  aiApiSettingsFromDesktop,
  crawlDocuments,
  createDefaultAiPromptProfilesState,
  createLlmClientFromSettings,
  defaultAiTagSelection,
  dictionaryTag,
  entriesFromRows,
  getActiveAiPromptProfile,
  inferEastAsianLanguageFromDocument,
  isAiSuggestReady,
  listAiTagOptions,
  parseDictionaryTable,
  formatAuthorityTagBombNotice,
  persistAiPromptProfiles,
  persistAuthoritySettings,
  readAiPromptProfilesFromDesktop,
  readPersistedAuthoritySettings,
  readSpreadsheet,
  resolveAutoTaggingSourceLanguage,
  settingsFromUiState,
  uiStateFromSettings,
  type AiPromptProfilesState,
  type AuthorityPackId,
  AUTHORITY_PACKS,
  groupAuthorityPacksByTagType,
  type DictionaryEntry,
  type Suggestion,
} from '../../autoTagging';
import {
  isJapaneseLanguageCode,
} from '../../utilities/languageCodes';
import { AutoTaggingApplyOverlay } from '../../layout/AutoTaggingApplyOverlay';
import { useActions } from '../../overmind';
import type { IDialog } from '../type';
import { AiPromptEditorDialog } from './AiPromptEditorDialog';
import { AiTagChipPicker } from './AiTagChipPicker';

const SPREADSHEET_RE = /\.(xlsx|xlsm|ods)$/i;
type DialogStep = 'methods' | 'ai' | 'authority';
type AiMode = 'suggest' | 'audit';

const defaultAuthorityPacksForLanguage = (
  language: string | null,
): Record<AuthorityPackId, boolean> => ({
  'cbdb-persons': false,
  'cbdb-places': false,
  'cbdb-offices': false,
  'dila-persons': !isJapaneseLanguageCode(language),
  'dila-places': false,
  'chgis-places': false,
  'wikidata-persons-tang': false,
  'wikidata-persons-pre-ming': false,
  'wikidata-persons-ming': false,
  'wikidata-persons-qing': false,
  'ndl-persons': isJapaneseLanguageCode(language),
  'ndl-works': false,
});

const visibleAuthorityPackIdsForLanguage = (language: string | null): AuthorityPackId[] =>
  isJapaneseLanguageCode(language)
    ? ['ndl-persons', 'ndl-works']
    : [
        'cbdb-persons',
        'cbdb-places',
        'cbdb-offices',
        'dila-persons',
        'dila-places',
        'chgis-places',
        'wikidata-persons-tang',
        'wikidata-persons-pre-ming',
        'wikidata-persons-ming',
        'wikidata-persons-qing',
      ];

/** CE presets for dynasty-scoped tag bombs. */
const AUTHORITY_YEAR_PRESETS = [
  { label: 'Eastern Han', start: 25, end: 220 },
  { label: 'Tang', start: 618, end: 907 },
  { label: 'Song', start: 960, end: 1279 },
  { label: 'Ming–Qing', start: 1368, end: 1912 },
] as const;

const AUTHORITY_YEAR_MIN = -500;
const AUTHORITY_YEAR_MAX = 2000;

const isDesktopApp = () => typeof window !== 'undefined' && !!window.electronAPI;

/**
 * Method chooser for auto-tagging. Produces suggestions, then hands off to the
 * docked review panel (split screen) — the editor stays visible, not greyed out.
 */
export const AutoTaggingDialog = ({ id, onClose, open = false }: IDialog) => {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<DialogStep>('methods');
  const [aiMode, setAiMode] = useState<AiMode>('suggest');
  const [aiTagOptions, setAiTagOptions] = useState<string[]>([]);
  const [aiSelectedTags, setAiSelectedTags] = useState<string[]>(['persName', 'placeName']);
  const [aiPromptProfiles, setAiPromptProfiles] = useState<AiPromptProfilesState>(
    createDefaultAiPromptProfilesState(),
  );
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const [authorityPacks, setAuthorityPacks] = useState<
    Record<AuthorityPackId, boolean>
  >(defaultAuthorityPacksForLanguage(null));
  const [authorityStatus, setAuthorityStatus] = useState<
    { id: AuthorityPackId; installed: boolean }[]
  >([]);
  const [entityDbFolder, setEntityDbFolder] = useState<string | null>(null);
  const [packsLocationHint, setPacksLocationHint] = useState<string | null>(null);
  const [authorityProgress, setAuthorityProgress] = useState('');
  const [authorityYearFilterEnabled, setAuthorityYearFilterEnabled] = useState(true);
  const [authorityYearRange, setAuthorityYearRange] = useState<[number, number]>([25, 220]);
  const [authorityHideUndated, setAuthorityHideUndated] = useState(true);
  const [sourceLanguage, setSourceLanguage] = useState<string | null>(null);
  const [workflowReady, setWorkflowReady] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const session = useRef<AutoTaggingSession | null>(null);
  const { startAutoTaggingReview } = useActions().ui;

  const aiSettings = aiApiSettingsFromDesktop();
  const aiReady = isAiSuggestReady(aiSettings);
  const activePromptProfile = useMemo(
    () => getActiveAiPromptProfile(aiPromptProfiles),
    [aiPromptProfiles],
  );

  const getSession = () => {
    session.current ??= new AutoTaggingSession(window.writer);
    return session.current;
  };

  const refreshWorkflowState = async () => {
    const doc = await getSession().getDocument();
    const lang = await resolveAutoTaggingSourceLanguage(doc, () =>
      window.__leafWriterProject?.getProjectSourceLanguage?.() ?? Promise.resolve(null),
    );
    setSourceLanguage(lang);
    setWorkflowReady(true);
  };

  const refreshAuthoritySetup = async () => {
    if (!isDesktopApp()) return;
    const folder = (await window.electronAPI?.getEntityDbFolder?.()) ?? null;
    const trimmed = folder?.trim() ? folder : null;
    setEntityDbFolder(trimmed);
    const statuses = await window.electronAPI?.authorityPackStatuses?.();
    setAuthorityStatus(
      AUTHORITY_PACKS.map((opt) => ({
        id: opt.id,
        installed: statuses?.find((s) => s.id === opt.id)?.installed ?? false,
      })),
    );

    setPacksLocationHint(null);
    if (trimmed && !statuses?.some((s) => s.installed)) {
      const parent = trimmed.replace(/[/\\][^/\\]+$/, '');
      const parentPacks = parent
        ? [
            `${parent}/authority-packs/dila/persons.ndjson`,
            `${parent}/authority-packs/ndl/persons.ndjson`,
          ]
        : [];
      const parentHasPacks = await Promise.all(
        parentPacks.map((candidate) => window.electronAPI?.pathExists?.(candidate)),
      ).then((hits) => hits.some(Boolean));
      if (parentHasPacks) {
        setPacksLocationHint(
          `Compiled packs were found in ${parent}/authority-packs/, but the entity database folder is set to a subfolder. Choose ${parent} in App Settings → Entity database.`,
        );
      }
    }
  };

  useEffect(() => {
    if (!open || !isDesktopApp()) return;
    void refreshAuthoritySetup();
    const saved = uiStateFromSettings(readPersistedAuthoritySettings());
    setAuthorityYearFilterEnabled(saved.yearFilterEnabled);
    setAuthorityYearRange(saved.yearRange);
    setAuthorityHideUndated(saved.hideUndated);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const saved = uiStateFromSettings(readPersistedAuthoritySettings());
    const defaults = defaultAuthorityPacksForLanguage(sourceLanguage);
    const visibleIds = new Set(visibleAuthorityPackIdsForLanguage(sourceLanguage));
    const visibleSaved = Object.entries(saved.packs).some(
      ([id, enabled]) => visibleIds.has(id as AuthorityPackId) && enabled,
    );
    setAuthorityPacks(visibleSaved ? saved.packs : defaults);
  }, [open, sourceLanguage]);

  useEffect(() => {
    if (!open || step !== 'ai') return;
    const options = listAiTagOptions(window.writer);
    setAiTagOptions(options);
    setAiSelectedTags((current) => {
      const kept = current.filter((tag) => options.includes(tag));
      return kept.length > 0 ? kept : defaultAiTagSelection(options);
    });
    void readAiPromptProfilesFromDesktop().then(setAiPromptProfiles);
  }, [open, step]);

  useEffect(() => {
    if (!open) {
      setWorkflowReady(false);
      return;
    }
    void refreshWorkflowState().catch(async () => {
      try {
        const doc = await getSession().getDocument();
        setSourceLanguage(inferEastAsianLanguageFromDocument(doc));
      } catch {
        setSourceLanguage(null);
      }
      setWorkflowReady(true);
    });
  }, [open]);

  const visibleAuthorityPackIds = visibleAuthorityPackIdsForLanguage(sourceLanguage);
  const visibleAuthorityPackGroups = groupAuthorityPacksByTagType(visibleAuthorityPackIds);
  const anyVisibleAuthorityPackInstalled = visibleAuthorityPackIds.some(
    (id) => authorityStatus.find((s) => s.id === id)?.installed ?? false,
  );
  const authoritySetupReady = Boolean(entityDbFolder) && anyVisibleAuthorityPackInstalled;
  const authorityPackGroupLabel = isJapaneseLanguageCode(sourceLanguage)
    ? 'NDL'
    : 'CBDB / DILA';

  const beginReview = (produced: Suggestion[], notice?: string) => {
    startAutoTaggingReview({ suggestions: produced, notice });
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

  const openAiStep = (mode: AiMode) => {
    if (!isDesktopApp()) {
      setError(`AI ${mode} is available in the desktop app.`);
      return;
    }
    if (!aiReady) {
      setError(
        'Configure the AI API in Application Settings: set a base URL and model (and an API key for hosted providers).',
      );
      return;
    }
    setError(null);
    setAiMode(mode);
    setStep('ai');
  };

  const openAuthorityStep = () => {
    if (!isDesktopApp()) {
      setError('Authority packs are available in the desktop app.');
      return;
    }
    if (!window.electronAPI?.authorityPackRead) {
      setError('Authority pack API is not available. Restart the desktop app.');
      return;
    }
    setError(null);
    setStep('authority');
  };

  const chooseEntityDbFolder = async () => {
    setError(null);
    const picked = await window.electronAPI?.pickEntityDbFolder?.();
    if (!picked) return;

    const folder = picked.replace(/[/\\]+$/, '');
    const entitiesHere = await window.electronAPI?.pathExists?.(`${folder}/entities.xml`);
    if (!entitiesHere) {
      const parent = folder.replace(/[/\\][^/\\]+$/, '');
      const entitiesInParent =
        parent.length > 0 &&
        (await window.electronAPI?.pathExists?.(`${parent}/entities.xml`));
      if (entitiesInParent) {
        setError(
          `No entities.xml in that folder. Your entity database is probably the parent folder (${parent}) — choose that, not the project subfolder inside it.`,
        );
        return;
      }
      setError(
        'No entities.xml in that folder. Pick the folder that contains entities.xml; compiled packs go in authority-packs/ beside it.',
      );
    }

    await window.electronAPI?.setEntityDbFolder?.(picked);
    await refreshAuthoritySetup();
  };

  const installAuthorityPacks = async () => {
    if (!entityDbFolder) {
      setError('Choose an entity database folder first (App Settings → Entity database).');
      return;
    }
    const source = await window.electronAPI?.pickAuthorityPacksSource?.();
    if (!source) return;

    setError(null);
    setBusy(true);
    try {
      const result = await window.electronAPI?.authorityPackInstallFrom?.(source);
      if (!result?.ok) {
        setError(result?.error ?? 'Install failed.');
        return;
      }
      await refreshAuthoritySetup();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runAuthorityTagBomb = async () => {
    const selected = visibleAuthorityPackIds.filter((id) => authorityPacks[id]);
    if (selected.length === 0) {
      setError('Select at least one authority pack.');
      return;
    }
    const readPack = window.electronAPI?.authorityPackRead;
    if (!readPack) {
      setError('Authority pack API is not available.');
      return;
    }

    setError(null);
    setBusy(true);
    setAuthorityProgress('Starting…');
    try {
      await persistAuthoritySettings(
        settingsFromUiState({
          packs: authorityPacks,
          yearFilterEnabled: authorityYearFilterEnabled,
          yearRange: authorityYearRange,
          hideUndated: authorityHideUndated,
        }),
      );
      const [yearStart, yearEnd] = authorityYearRange;
      const result = await getSession().runAuthorityTagBomb(selected, readPack, {
        onProgress: setAuthorityProgress,
        ...(authorityYearFilterEnabled
          ? {
              yearRange: {
                start: Math.min(yearStart, yearEnd),
                end: Math.max(yearStart, yearEnd),
              },
              hideUndated: authorityHideUndated,
            }
          : {}),
      });
      if (result.suggestions.length === 0) {
        const filterNote = authorityYearFilterEnabled
          ? ` (${Math.min(...authorityYearRange)}–${Math.max(...authorityYearRange)} CE${authorityHideUndated ? ', undated excluded' : ''})`
          : '';
        setError(
          `No untagged matches (${result.candidateCount.toLocaleString()} authority entries after filters${filterNote}).`,
        );
        return;
      }
      beginReview(result.suggestions, formatAuthorityTagBombNotice(result));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setAuthorityProgress('');
    }
  };

  const runAi = async () => {
    const tags = aiSelectedTags;
    if (tags.length === 0) {
      setError('Select at least one tag type.');
      return;
    }
    const settings = aiApiSettingsFromDesktop();
    if (!settings || !isAiSuggestReady(settings)) {
      setError('AI API is not configured.');
      return;
    }

    if (aiMode === 'audit') {
      const hasTags = await getSession().hasTaggedMentions(tags);
      if (!hasTags) {
        setError(
          'No existing tags to audit for the selected types. Tag the document first (dictionary, crawl, or suggest).',
        );
        return;
      }
    }

    setError(null);
    setBusy(true);
    setAiProgress({ done: 0, total: 0 });
    try {
      const client = createLlmClientFromSettings(settings);
      const onProgress = (done: number, total: number) => setAiProgress({ done, total });
      const result =
        aiMode === 'audit'
          ? await getSession().runAiAudit(tags, client, onProgress, activePromptProfile)
          : await getSession().runAiSuggest(tags, client, onProgress, activePromptProfile);

      if (result.suggestions.length === 0) {
        setError(
          result.unverifiableCount > 0
            ? `No verifiable ${aiMode === 'audit' ? 'findings' : 'suggestions'} (${result.unverifiableCount} model claims could not be anchored in the document).`
            : aiMode === 'audit'
              ? 'No issues found — the model did not propose any corrections.'
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

  const methodButton = (
    label: string,
    onClick: () => void,
    disabled = false,
    title?: string,
    emphasize = false,
  ) => (
    <Button
      size="small"
      variant={emphasize ? 'contained' : 'text'}
      color={emphasize ? 'primary' : 'inherit'}
      disabled={disabled || busy || !workflowReady}
      title={title}
      onClick={onClick}
      sx={{
        justifyContent: 'flex-start',
        textTransform: 'none',
        px: 1,
        py: 0.25,
        ...(disabled || !workflowReady
          ? { color: 'text.disabled' }
          : emphasize
            ? { fontWeight: 600 }
            : {}),
      }}
    >
      {label}
    </Button>
  );

  const aiBusyLabel = aiMode === 'audit' ? 'Running AI audit…' : 'Running AI suggest…';

  return (
    <>
      <AutoTaggingApplyOverlay
        open={busy && (step === 'ai' || step === 'authority')}
        label={
          step === 'authority'
            ? authorityProgress || 'Loading authority packs…'
            : aiBusyLabel
        }
        done={step === 'ai' ? aiProgress.done : 0}
        total={step === 'ai' ? aiProgress.total : 0}
      />
      <Dialog
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: { width: step === 'methods' ? 340 : 380, m: 1, borderRadius: 1 },
        }}
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
              {!workflowReady ? (
                <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 0.5 }}>
                  Checking document language…
                </Typography>
              ) : (
                <>
              {methodButton(
                'Tag from a list (CSV, TSV, xlsx, ODS)',
                () => fileInput.current?.click(),
              )}
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
              {methodButton(
                'From existing tags in this project',
                () => void crawlProject(),
              )}
              {methodButton(
                `Tag from authority packs (${authorityPackGroupLabel})`,
                () => openAuthorityStep(),
                !isDesktopApp(),
                !isDesktopApp() ? 'Desktop app only' : undefined,
              )}
              {methodButton(
                'AI suggest',
                () => openAiStep('suggest'),
                !isDesktopApp(),
                !isDesktopApp() ? 'Desktop app only' : undefined,
              )}
              {methodButton(
                'AI audit',
                () => openAiStep('audit'),
                !isDesktopApp(),
                !isDesktopApp() ? 'Desktop app only' : undefined,
              )}
              {methodButton('NER', () => {}, true)}
                </>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                <Link component="button" variant="caption" underline="hover" onClick={handleClose}>
                  Close
                </Link>
              </Box>
            </Stack>
          ) : step === 'authority' ? (
            <Stack spacing={1} sx={{ mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Match pre-compiled {authorityPackGroupLabel} strings. Clue lines appear in review;
                no ids until disambiguation.
              </Typography>
              {!entityDbFolder && (
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  No entity database folder configured. Pick the folder that contains{' '}
                  <code>entities.xml</code> — not the project subfolder inside it. Compiled packs
                  install to <code>authority-packs/</code> beside that file.
                  <Box sx={{ mt: 1 }}>
                    <Button size="small" variant="outlined" disabled={busy} onClick={() => void chooseEntityDbFolder()}>
                      Choose entity database folder…
                    </Button>
                  </Box>
                </Alert>
              )}
              {packsLocationHint && (
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  {packsLocationHint}
                </Alert>
              )}
              {entityDbFolder && !anyVisibleAuthorityPackInstalled && !packsLocationHint && (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  Entity database: {entityDbFolder}
                  <br />
                  No compiled packs found in <code>authority-packs/</code> yet.
                  <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button size="small" variant="outlined" disabled={busy} onClick={() => void installAuthorityPacks()}>
                      Install from folder…
                    </Button>
                  </Box>
                </Alert>
              )}
              <Stack spacing={1.25}>
                {visibleAuthorityPackGroups.map((group) => (
                  <Box key={group.tag}>
                    <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
                      {group.label}
                    </Typography>
                    <Stack>
                      {group.packs.map((opt) => {
                        const installed =
                          authorityStatus.find((s) => s.id === opt.id)?.installed ?? false;
                        return (
                          <FormControlLabel
                            key={opt.id}
                            control={
                              <Checkbox
                                size="small"
                                checked={authorityPacks[opt.id]}
                                disabled={busy || !installed}
                                onChange={(event) =>
                                  setAuthorityPacks((current) => ({
                                    ...current,
                                    [opt.id]: event.target.checked,
                                  }))
                                }
                              />
                            }
                            label={`${opt.label}${installed ? '' : ' (not installed)'}`}
                            sx={{ ml: 0 }}
                          />
                        );
                      })}
                    </Stack>
                  </Box>
                ))}
              </Stack>
              <Box sx={{ px: 0.5 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={authorityYearFilterEnabled}
                      disabled={busy}
                      onChange={(event) => setAuthorityYearFilterEnabled(event.target.checked)}
                    />
                  }
                  label="Limit to year range (CE)"
                  sx={{ ml: 0 }}
                />
                {authorityYearFilterEnabled && (
                  <Stack spacing={0.75} sx={{ pl: 3.5, pr: 0.5, pb: 0.5 }}>
                    <Slider
                      size="small"
                      min={AUTHORITY_YEAR_MIN}
                      max={AUTHORITY_YEAR_MAX}
                      step={1}
                      value={authorityYearRange}
                      onChange={(_event, value) =>
                        setAuthorityYearRange(value as [number, number])
                      }
                      valueLabelDisplay="auto"
                      getAriaLabel={(index) => (index === 0 ? 'Start year' : 'End year')}
                      getAriaValueText={(value) => `${value} CE`}
                      disabled={busy}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {Math.min(...authorityYearRange)} – {Math.max(...authorityYearRange)} CE
                      (include entries whose lifespan overlaps this span)
                    </Typography>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={authorityHideUndated}
                          disabled={busy}
                          onChange={(event) => setAuthorityHideUndated(event.target.checked)}
                        />
                      }
                      label="Exclude undated persons (DILA places always included)"
                      sx={{ ml: 0 }}
                    />
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {AUTHORITY_YEAR_PRESETS.map((preset) => (
                        <Button
                          key={preset.label}
                          size="small"
                          variant="outlined"
                          disabled={busy}
                          onClick={() => setAuthorityYearRange([preset.start, preset.end])}
                          sx={{ py: 0, minWidth: 0, textTransform: 'none' }}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </Stack>
                  </Stack>
                )}
              </Box>
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
                <Button
                  size="small"
                  variant="contained"
                  disabled={busy || !authoritySetupReady}
                  onClick={() => void runAuthorityTagBomb()}
                >
                  Run tag bomb
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={1} sx={{ mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                {aiMode === 'audit'
                  ? 'Review existing tags for mistakes. The model sees current boundaries inline; results open in the review panel.'
                  : 'Ask the configured model to find entity mentions. Results open in the review panel.'}
              </Typography>
              {aiSettings?.model && (
                <Typography variant="caption" color="text.secondary">
                  Model: {aiSettings.model}
                </Typography>
              )}
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="caption" color="text.secondary">
                  Prompt profile: {activePromptProfile.label}
                </Typography>
                <Link
                  component="button"
                  variant="caption"
                  underline="hover"
                  disabled={busy}
                  onClick={() => setPromptEditorOpen(true)}
                >
                  Edit prompt…
                </Link>
              </Stack>
              <AiTagChipPicker
                options={aiTagOptions}
                value={aiSelectedTags}
                disabled={busy}
                onChange={setAiSelectedTags}
              />
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
                <Button size="small" variant="contained" disabled={busy} onClick={() => void runAi()}>
                  {aiMode === 'audit' ? 'Run AI audit' : 'Run AI suggest'}
                </Button>
              </Stack>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
      <AiPromptEditorDialog
        open={promptEditorOpen}
        state={aiPromptProfiles}
        onClose={() => setPromptEditorOpen(false)}
        onSave={async (next) => {
          await persistAiPromptProfiles(next);
          setAiPromptProfiles(next);
        }}
      />
    </>
  );
};
