import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogContent,
  FormControlLabel,
  IconButton,
  Link,
  Slider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AutoTaggingSession,
  aiApiSettingsFromDesktop,
  candidatesFromEntityDatabase,
  centralEntityStoreFromDesktop,
  countAuthorityPackStrings,
  countCandidatesUniqueStrings,
  createDefaultAiPromptProfilesState,
  createLlmClientFromSettings,
  defaultAiTagSelection,
  entriesFromRows,
  getActiveAiPromptProfile,
  inferEastAsianLanguageFromDocument,
  isAiSuggestReady,
  listAiTagOptions,
  parseDictionaryTable,
  formatAuthorityTagBombNotice,
  persistAiPromptProfiles,
  persistValidationSettings,
  readPersistedValidationSettings,
  defaultAuthorityPacksRecord,
  entityStoreFromDesktop,
  OWN_DATABASE_KIND_BY_PACK_ID,
  persistAuthoritySettings,
  readAiPromptProfilesFromDesktop,
  readPersistedAuthoritySettings,
  readSpreadsheet,
  resolveAutoTaggingSourceLanguage,
  settingsFromUiState,
  uiStateFromSettings,
  AUTHORITY_YEAR_MIN,
  AUTHORITY_YEAR_MAX,
  type AiPromptProfilesState,
  type AuthorityPackId,
  type AuthorityPackStringCounts,
  type DateFilterMode,
  AUTHORITY_PACKS,
  AUTHORITY_SOURCE_LABELS,
  authorityPackOrigin,
  expandAuthorityPackIds,
  groupAuthorityPacksByTagType,
  UI_AUTHORITY_PACK_IDS,
  WIKIDATA_PERSON_CHILD_PACK_IDS,
  type Suggestion,
  type TagBombImportedList,
  appendAutoTaggingBatch,
  finishAiRunProgress,
  startAiRunProgress,
  updateAiRunProgress,
} from '../../autoTagging';
import {
  isChineseLanguageCode,
  isJapaneseLanguageCode,
  isTibetanLanguageCode,
} from '../../utilities/languageCodes';
import { AutoTaggingApplyOverlay } from '../../layout/AutoTaggingApplyOverlay';
import { useActions } from '../../overmind';
import type { IDialog } from '../type';
import { AiPromptEditorDialog } from './AiPromptEditorDialog';
import { AiTagChipPicker } from './AiTagChipPicker';
import { cachedPackReader } from '../../services/authority-pack-lookup';

const SPREADSHEET_RE = /\.(xlsx|xlsm|ods)$/i;
type DialogStep = 'methods' | 'ai' | 'authority';
type AiMode = 'suggest' | 'audit';

const defaultAuthorityPacksForLanguage = (
  language: string | null,
): Record<AuthorityPackId, boolean> =>
  defaultAuthorityPacksRecord({
    'dila-persons': !isJapaneseLanguageCode(language) && !isTibetanLanguageCode(language),
    'ndl-persons': isJapaneseLanguageCode(language),
    'wikidata-persons-ja': isJapaneseLanguageCode(language),
    'wikidata-persons-bo': isTibetanLanguageCode(language),
  });

const visibleAuthorityPackIdsForLanguage = (language: string | null): AuthorityPackId[] =>
  isJapaneseLanguageCode(language)
    ? [
        'ndl-persons',
        'ndl-places',
        'ndl-orgs',
        'ndl-works',
        'wikidata-persons-ja',
        'wikidata-orgs-ja',
        'wikidata-works-ja',
      ]
    : isTibetanLanguageCode(language)
      ? ['wikidata-persons-bo', 'wikidata-places-bo', 'wikidata-orgs-bo']
      : isChineseLanguageCode(language) || !language
        ? [
            'cbdb-persons',
            'cbdb-places',
            'cbdb-offices',
            'dila-persons',
            'dila-places',
            'chgis-places',
            'wikidata-persons',
            'wikidata-orgs-zh-hant',
            'wikidata-works-zh-hant',
          ]
        : UI_AUTHORITY_PACK_IDS.filter((id) => !id.startsWith('ndl-'));

/** The user's own databases (project, then central) always lead every category group. */
const OWN_DATABASE_PACK_IDS: AuthorityPackId[] = AUTHORITY_PACKS.filter((spec) => {
  const origin = authorityPackOrigin(spec);
  return origin === 'pedb' || origin === 'cedb';
}).map((spec) => spec.id);

/**
 * Project tags/imported lists are language-agnostic and always pooled into
 * every category group, after whatever file packs the language filter shows.
 */
const POOLED_AUTHORITY_PACK_IDS: AuthorityPackId[] = AUTHORITY_PACKS.filter((spec) => {
  const origin = authorityPackOrigin(spec);
  return origin === 'project' || origin === 'list';
}).map((spec) => spec.id);

/** CE presets for dynasty-scoped tag bombs. */
const AUTHORITY_YEAR_PRESETS = [
  { label: 'Eastern Han', start: 25, end: 220 },
  { label: 'Tang', start: 618, end: 907 },
  { label: 'Song', start: 960, end: 1279 },
  { label: 'Ming–Qing', start: 1368, end: 1912 },
] as const;

const AUTHORITY_COUNT_DEBOUNCE_MS = 450;

const authorityOptionSx = {
  ml: 0,
  mr: 0,
  py: 0,
  minHeight: 24,
  '& .MuiFormControlLabel-label': { fontSize: '0.75rem', lineHeight: 1.25 },
} as const;

const authoritySourceHeadingSx = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'text.secondary',
  pl: 0.25,
  pt: 0.5,
  pb: 0.125,
} as const;

const formatPackStringCount = (
  counts: AuthorityPackStringCounts,
  packId: AuthorityPackId,
  loading: boolean,
): string => {
  const count = counts[packId];
  if (count) return ` · ${count.uniqueStrings.toLocaleString()} strings`;
  if (loading) return ' · …';
  return '';
};

const isAuthorityPackInstalled = (
  packId: AuthorityPackId,
  statuses: { id: AuthorityPackId; installed: boolean }[],
): boolean =>
  packId === 'wikidata-persons'
    ? WIKIDATA_PERSON_CHILD_PACK_IDS.some(
        (childId) => statuses.find((status) => status.id === childId)?.installed ?? false,
      )
    : (statuses.find((status) => status.id === packId)?.installed ?? false);

/**
 * Availability for non-file rows. PEDB and CEDB currently share the entity
 * database folder setting (see `entityStore.ts`'s `centralEntityStoreFromDesktop`
 * fallback) until a dedicated central-folder setting exists — both gate on
 * `entityDbFolder`. Project tags are always available; an imported list needs
 * at least one file chosen.
 */
const isAuthorityPackAvailable = (
  packId: AuthorityPackId,
  statuses: { id: AuthorityPackId; installed: boolean }[],
  entityDbFolder: string | null,
  importedListCount: number,
): boolean => {
  const spec = AUTHORITY_PACKS.find((p) => p.id === packId);
  const origin = spec ? authorityPackOrigin(spec) : 'file';
  switch (origin) {
    case 'pedb':
    case 'cedb':
      return Boolean(entityDbFolder);
    case 'project':
      return true;
    case 'list':
      return importedListCount > 0;
    default:
      return isAuthorityPackInstalled(packId, statuses);
  }
};

const unavailableSuffixFor = (origin: ReturnType<typeof authorityPackOrigin>): string => {
  switch (origin) {
    case 'pedb':
    case 'cedb':
      return ' (no entity database configured)';
    case 'list':
      return ' (add a file below)';
    case 'project':
      return '';
    default:
      return ' (not installed)';
  }
};

/**
 * Live "· N strings" preview for PEDB/CEDB rows, mirroring the NDJSON pack
 * preview but reading straight from entities.xml — one load per database,
 * reused across every requested kind.
 */
const countOwnDatabasePackStrings = async (
  ids: AuthorityPackId[],
  range?: { mode: DateFilterMode; start: number; end: number },
): Promise<AuthorityPackStringCounts> => {
  const out: AuthorityPackStringCounts = {};

  const pedbIds = ids.filter((id) => id in OWN_DATABASE_KIND_BY_PACK_ID && id.startsWith('pedb-'));
  if (pedbIds.length > 0) {
    const store = entityStoreFromDesktop();
    if (store) {
      const doc = await store.loadEntities();
      for (const id of pedbIds) {
        const kind = OWN_DATABASE_KIND_BY_PACK_ID[id];
        if (!kind) continue;
        out[id] = countCandidatesUniqueStrings(candidatesFromEntityDatabase(doc, kind, 'PEDB'), range);
      }
    }
  }

  const cedbIds = ids.filter((id) => id in OWN_DATABASE_KIND_BY_PACK_ID && id.startsWith('cedb-'));
  if (cedbIds.length > 0) {
    const store = centralEntityStoreFromDesktop(null);
    if (store) {
      const doc = await store.loadEntities();
      for (const id of cedbIds) {
        const kind = OWN_DATABASE_KIND_BY_PACK_ID[id];
        if (!kind) continue;
        out[id] = countCandidatesUniqueStrings(candidatesFromEntityDatabase(doc, kind, 'CEDB'), range);
      }
    }
  }

  return out;
};

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
  const [aiValidation, setAiValidation] = useState(true);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [limitToSelection, setLimitToSelection] = useState(true);
  const [authorityPacks, setAuthorityPacks] = useState<Record<AuthorityPackId, boolean>>(
    defaultAuthorityPacksForLanguage(null),
  );
  const [authorityStatus, setAuthorityStatus] = useState<
    { id: AuthorityPackId; installed: boolean }[]
  >([]);
  const [entityDbFolder, setEntityDbFolder] = useState<string | null>(null);
  const [packsLocationHint, setPacksLocationHint] = useState<string | null>(null);
  const [authorityProgress, setAuthorityProgress] = useState('');
  const [authorityDateFilter, setAuthorityDateFilter] = useState<DateFilterMode>('limit');
  const [authorityYearRange, setAuthorityYearRange] = useState<[number, number]>([25, 220]);
  const cycleAuthorityDateFilter = () => {
    setAuthorityDateFilter((mode) =>
      mode === 'none' ? 'limit' : mode === 'limit' ? 'exclude' : 'none',
    );
  };
  const [importedLists, setImportedLists] = useState<TagBombImportedList[]>([]);
  const [authorityPackCounts, setAuthorityPackCounts] = useState<AuthorityPackStringCounts>({});
  const [authorityPackCountsLoading, setAuthorityPackCountsLoading] = useState(false);
  const authorityCountGeneration = useRef(0);
  const [sourceLanguage, setSourceLanguage] = useState<string | null>(null);
  const [workflowReady, setWorkflowReady] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const session = useRef<AutoTaggingSession | null>(null);
  const aiAbort = useRef<AbortController | null>(null);

  // Closing the dialog (or unmounting) aborts any in-flight AI request so a
  // local model server stops generating instead of running to completion.
  useEffect(() => () => aiAbort.current?.abort(), []);
  const { startAutoTaggingReview, dismissReviewPanes, notifyViaSnackbar } = useActions().ui;

  // Opening the launcher abandons any in-progress review or disambiguation
  // walk without saving — the new run starts from a clean slate.
  useEffect(() => {
    if (open) dismissReviewPanes();
  }, [open, dismissReviewPanes]);

  // Capture the editor selection at open — TinyMCE keeps its range while the
  // dialog has focus, but the user may click around before running AI.
  useEffect(() => {
    if (!open) {
      setSelectionRange(null);
      setLimitToSelection(true);
      setImportedLists([]);
      return;
    }
    void getSession()
      .getSelectionRange()
      .then(setSelectionRange)
      .catch(() => setSelectionRange(null));
    // getSession is stable for the dialog's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    const lang = await resolveAutoTaggingSourceLanguage(
      doc,
      () => window.__leafWriterProject?.getProjectSourceLanguage?.() ?? Promise.resolve(null),
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
    const saved = uiStateFromSettings(
      readPersistedAuthoritySettings(),
      window.__leafWriterProject?.getActiveFileWorkYear?.(),
    );
    setAuthorityDateFilter(saved.dateFilter);
    setAuthorityYearRange(saved.yearRange);
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
    if (!open) return;
    const validationSettings = readPersistedValidationSettings();
    setAiValidation(validationSettings?.aiValidation ?? true);
  }, [open]);

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

  const visibleAuthorityPackIds = useMemo(
    () => [
      ...OWN_DATABASE_PACK_IDS,
      ...visibleAuthorityPackIdsForLanguage(sourceLanguage),
      ...POOLED_AUTHORITY_PACK_IDS,
    ],
    [sourceLanguage],
  );
  const visibleAuthorityPackGroups = useMemo(
    () => groupAuthorityPacksByTagType(visibleAuthorityPackIds),
    [visibleAuthorityPackIds],
  );
  const anyVisibleFilePackInstalled = visibleAuthorityPackIds
    .filter((id) => {
      const spec = AUTHORITY_PACKS.find((p) => p.id === id);
      return spec ? authorityPackOrigin(spec) === 'file' : true;
    })
    .some((id) => isAuthorityPackInstalled(id, authorityStatus));
  const anyCheckedSourceAvailable = visibleAuthorityPackIds.some(
    (id) =>
      authorityPacks[id] &&
      isAuthorityPackAvailable(id, authorityStatus, entityDbFolder, importedLists.length),
  );

  useEffect(() => {
    if (step !== 'authority' || !entityDbFolder || busy || !isDesktopApp()) {
      setAuthorityPackCounts({});
      setAuthorityPackCountsLoading(false);
      return;
    }

    const generation = ++authorityCountGeneration.current;
    setAuthorityPackCountsLoading(true);

    const timeout = window.setTimeout(() => {
      void (async () => {
        const installedIds = new Set(
          authorityStatus.filter((status) => status.installed).map((status) => status.id),
        );
        const [yearStart, yearEnd] = authorityYearRange;
        const range =
          authorityDateFilter === 'none'
            ? undefined
            : {
                mode: authorityDateFilter,
                start: Math.min(yearStart, yearEnd),
                end: Math.max(yearStart, yearEnd),
              };

        try {
          const counts: AuthorityPackStringCounts = {};
          const readPack = cachedPackReader();
          if (readPack) {
            Object.assign(
              counts,
              await countAuthorityPackStrings(visibleAuthorityPackIds, readPack, installedIds, range),
            );
          }
          Object.assign(counts, await countOwnDatabasePackStrings(visibleAuthorityPackIds, range));
          if (generation !== authorityCountGeneration.current) return;
          setAuthorityPackCounts(counts);
        } catch {
          if (generation !== authorityCountGeneration.current) return;
          setAuthorityPackCounts({});
        } finally {
          if (generation === authorityCountGeneration.current) {
            setAuthorityPackCountsLoading(false);
          }
        }
      })();
    }, AUTHORITY_COUNT_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [
    step,
    entityDbFolder,
    busy,
    authorityStatus,
    authorityDateFilter,
    authorityYearRange,
    visibleAuthorityPackIds,
  ]);
  const beginReview = (produced: Suggestion[], notice?: string) => {
    startAutoTaggingReview({ suggestions: produced, notice, aiValidation });
    handleClose();
  };

  const addImportedFile = async (file: File) => {
    setError(null);
    try {
      const entries = SPREADSHEET_RE.test(file.name)
        ? entriesFromRows(await readSpreadsheet(await file.arrayBuffer(), file.name))
        : parseDictionaryTable(await file.text());
      if (entries.length === 0) {
        setError(`No usable entries found in ${file.name}. Expected columns: string, tag.`);
        return;
      }
      setImportedLists((current) => [...current, { name: file.name, entries }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeImportedFile = (name: string) => {
    setImportedLists((current) => current.filter((file) => file.name !== name));
  };

  const aiDisabled = !isDesktopApp() || !aiReady;
  const aiDisabledReason = !isDesktopApp()
    ? 'Desktop app only'
    : !aiReady
      ? 'Configure the AI API in Application Settings (API key, base URL, and model).'
      : undefined;

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
        parent.length > 0 && (await window.electronAPI?.pathExists?.(`${parent}/entities.xml`));
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

  const runTagBomb = async () => {
    const installedIds = new Set(
      authorityStatus.filter((status) => status.installed).map((status) => status.id),
    );
    const checked = expandAuthorityPackIds(visibleAuthorityPackIds.filter((id) => authorityPacks[id]));
    const originOf = (id: AuthorityPackId) => {
      const spec = AUTHORITY_PACKS.find((p) => p.id === id);
      return spec ? authorityPackOrigin(spec) : 'file';
    };
    const selected = checked.filter((id) => (originOf(id) === 'file' ? installedIds.has(id) : true));
    if (selected.length === 0) {
      setError('Select at least one source.');
      return;
    }
    const needsFileReader = selected.some((id) => originOf(id) === 'file');
    const readPack = cachedPackReader();
    if (needsFileReader && !readPack) {
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
          dateFilter: authorityDateFilter,
          yearRange: authorityYearRange,
        }),
      );
      const [yearStart, yearEnd] = authorityYearRange;
      const dateFilter =
        authorityDateFilter === 'none'
          ? undefined
          : {
              mode: authorityDateFilter,
              start: Math.min(yearStart, yearEnd),
              end: Math.max(yearStart, yearEnd),
            };
      const result = await getSession().runTagBomb(
        selected,
        readPack ?? (async () => ''),
        {
          onProgress: setAuthorityProgress,
          ...(dateFilter ? { dateFilter } : {}),
          importedLists,
        },
      );
      if (result.suggestions.length === 0) {
        const filterNote =
          authorityDateFilter === 'none'
            ? ''
            : ` (${Math.min(...authorityYearRange)}–${Math.max(...authorityYearRange)} CE, ${authorityDateFilter})`;
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

    aiAbort.current?.abort();
    const abortController = new AbortController();
    aiAbort.current = abortController;
    const streaming = settings.streamResults === true;
    let reviewStarted = false;
    const onChunk = (suggestions: Suggestion[]) => {
      if (!streaming || suggestions.length === 0) return;
      if (!reviewStarted) {
        reviewStarted = true;
        beginReview([], undefined);
      }
      appendAutoTaggingBatch(suggestions);
    };
    const execute = async (background: boolean) => {
      if (background) startAiRunProgress(`AI ${aiMode}`, () => abortController.abort());
      else {
        setBusy(true);
        setAiProgress({ done: 0, total: 0 });
      }
      try {
        const client = createLlmClientFromSettings(settings);
        const onProgress = (done: number, total: number) => {
          if (background) updateAiRunProgress(done, total);
          else setAiProgress({ done, total });
        };
        const range = limitToSelection ? selectionRange : null;
        const result =
          aiMode === 'audit'
            ? await getSession().runAiAudit(
                tags,
                client,
                onProgress,
                activePromptProfile,
                abortController.signal,
                range,
                onChunk,
              )
            : await getSession().runAiSuggest(
                tags,
                client,
                onProgress,
                activePromptProfile,
                abortController.signal,
                range,
                onChunk,
              );

        if (result.suggestions.length === 0) {
          if (!background)
            setError(
              result.unverifiableCount > 0
                ? `No verifiable ${aiMode === 'audit' ? 'findings' : 'suggestions'} (${result.unverifiableCount} model claims could not be anchored in the document).`
                : aiMode === 'audit'
                  ? 'No issues found — the model did not propose any corrections.'
                  : 'No suggestions from the model for the selected tags.',
            );
          return;
        }
        if (!reviewStarted) beginReview(result.suggestions);
      } catch (e) {
        if (!abortController.signal.aborted) {
          if (!background) setError(e instanceof Error ? e.message : String(e));
          else {
            console.warn('[auto-tagging] background AI run failed:', e);
            notifyViaSnackbar({
              message: `AI ${aiMode} failed: ${e instanceof Error ? e.message : String(e)}`,
              options: { variant: 'error' },
            });
          }
        }
      } finally {
        if (background) finishAiRunProgress();
        else {
          setBusy(false);
          setAiProgress({ done: 0, total: 0 });
        }
      }
    };

    setError(null);
    if (streaming) {
      await execute(false);
    } else {
      void execute(true);
      setStep('methods');
      onClose?.(id);
    }
  };

  const handleClose = () => {
    aiAbort.current?.abort();
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
        label={step === 'authority' ? authorityProgress || 'Loading tag bomb sources…' : aiBusyLabel}
        done={step === 'ai' ? aiProgress.done : 0}
        total={step === 'ai' ? aiProgress.total : 0}
      />
      <Dialog
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: step === 'methods' ? 340 : step === 'authority' ? 680 : 380,
            m: 1,
            borderRadius: 1,
          },
        }}
      >
        <DialogContent sx={{ p: 1.5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {step === 'authority' ? 'Tag bomb' : 'Auto-tagging'}
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
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={aiValidation}
                        onChange={(event) => {
                          setAiValidation(event.target.checked);
                          void persistValidationSettings({ aiValidation: event.target.checked });
                        }}
                      />
                    }
                    label={
                      <Typography variant="caption">
                        AI validation (pre-select best candidates, show warnings)
                      </Typography>
                    }
                    sx={{ ml: 0, mb: 0.5 }}
                  />
                  {methodButton(
                    'Tag bomb',
                    () => openAuthorityStep(),
                    !isDesktopApp(),
                    !isDesktopApp() ? 'Desktop app only' : undefined,
                  )}
                  {isDesktopApp() && !aiReady && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ px: 1, py: 0.125, fontSize: '0.6875rem', lineHeight: 1.35 }}
                    >
                      AI suggest and audit need a tested API connection — configure and test it in
                      Application Settings.
                    </Typography>
                  )}
                  {methodButton(
                    'AI suggest',
                    () => openAiStep('suggest'),
                    aiDisabled,
                    aiDisabledReason,
                  )}
                  {methodButton(
                    'AI audit',
                    () => openAiStep('audit'),
                    aiDisabled,
                    aiDisabledReason,
                  )}
                </>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                <Link component="button" variant="caption" underline="hover" onClick={handleClose}>
                  Close
                </Link>
              </Box>
            </Stack>
          ) : step === 'authority' ? (
            <Stack spacing={0.75} sx={{ mt: 0.25 }}>
              {!entityDbFolder && (
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  No entity database folder configured. Pick the folder that contains{' '}
                  <code>entities.xml</code> — not the project subfolder inside it. Compiled packs
                  install to <code>authority-packs/</code> beside that file.
                  <Box sx={{ mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={busy}
                      onClick={() => void chooseEntityDbFolder()}
                    >
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
              {entityDbFolder && !anyVisibleFilePackInstalled && !packsLocationHint && (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  Entity database: {entityDbFolder}
                  <br />
                  No compiled packs found in <code>authority-packs/</code> yet.
                  <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={busy}
                      onClick={() => void installAuthorityPacks()}
                    >
                      Install from folder…
                    </Button>
                  </Box>
                </Alert>
              )}
              <Box sx={{ px: 0.25 }}>
                <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600, fontSize: '0.6875rem' }}
                  >
                    Imported lists:
                  </Typography>
                  {importedLists.map((file) => (
                    <Chip
                      key={file.name}
                      size="small"
                      label={`${file.name} (${file.entries.length})`}
                      disabled={busy}
                      onDelete={() => removeImportedFile(file.name)}
                      sx={{ fontSize: '0.6875rem', height: 20 }}
                    />
                  ))}
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={busy}
                    onClick={() => fileInput.current?.click()}
                    sx={{
                      py: 0,
                      px: 0.75,
                      minWidth: 0,
                      minHeight: 22,
                      fontSize: '0.6875rem',
                      textTransform: 'none',
                    }}
                  >
                    + Add file…
                  </Button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".csv,.tsv,.txt,.xlsx,.xlsm,.ods"
                    multiple
                    hidden
                    data-testid="dictionary-file-input"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      for (const file of files) void addImportedFile(file);
                      event.target.value = '';
                    }}
                  />
                </Stack>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  columnGap: 2,
                  rowGap: 0.25,
                  alignItems: 'start',
                }}
              >
                {visibleAuthorityPackGroups.map((group) => (
                  <Box key={group.tag}>
                    <Typography variant="caption" sx={authoritySourceHeadingSx}>
                      {group.label}
                    </Typography>
                    <Stack spacing={0}>
                      {group.packs.map((opt) => {
                        const origin = authorityPackOrigin(opt);
                        const available = isAuthorityPackAvailable(
                          opt.id,
                          authorityStatus,
                          entityDbFolder,
                          importedLists.length,
                        );
                        const rowLabel = AUTHORITY_SOURCE_LABELS[opt.source];
                        const suffix = available
                          ? origin === 'file' || origin === 'pedb' || origin === 'cedb'
                            ? formatPackStringCount(authorityPackCounts, opt.id, authorityPackCountsLoading)
                            : ''
                          : unavailableSuffixFor(origin);
                        return (
                          <FormControlLabel
                            key={opt.id}
                            control={
                              <Checkbox
                                size="small"
                                checked={authorityPacks[opt.id]}
                                disabled={busy || !available}
                                sx={{ py: 0.125 }}
                                onChange={(event) =>
                                  setAuthorityPacks((current) => ({
                                    ...current,
                                    [opt.id]: event.target.checked,
                                  }))
                                }
                              />
                            }
                            label={`${rowLabel}${suffix}`}
                            sx={authorityOptionSx}
                          />
                        );
                      })}
                    </Stack>
                  </Box>
                ))}
              </Box>
              <Box sx={{ px: 0.25, pt: 0.25 }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Tooltip
                    title={
                      authorityDateFilter === 'none'
                        ? 'Date filter off — click to limit matches to the year range'
                        : authorityDateFilter === 'limit'
                          ? 'Limit: keep matches overlapping the year range'
                          : 'Exclude: drop matches overlapping the year range'
                    }
                  >
                    <span>
                      <IconButton
                        size="small"
                        aria-label="Toggle date filter mode"
                        disabled={busy}
                        onClick={cycleAuthorityDateFilter}
                        sx={{ p: 0.25, flexShrink: 0 }}
                      >
                        {authorityDateFilter === 'none' ? (
                          <FilterAltOffIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <FilterAltIcon
                            sx={{
                              fontSize: 16,
                              color:
                                authorityDateFilter === 'exclude' ? 'error.main' : 'primary.main',
                            }}
                          />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Slider
                    size="small"
                    min={AUTHORITY_YEAR_MIN}
                    max={AUTHORITY_YEAR_MAX}
                    step={1}
                    value={authorityYearRange}
                    onChange={(_event, value) => setAuthorityYearRange(value as [number, number])}
                    valueLabelDisplay="auto"
                    getAriaLabel={(index) => (index === 0 ? 'Start year' : 'End year')}
                    getAriaValueText={(value) => `${value} CE`}
                    disabled={busy || authorityDateFilter === 'none'}
                    sx={{ flex: 1, minWidth: 0, mx: 0.5 }}
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: '0.6875rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    {Math.min(...authorityYearRange)}–{Math.max(...authorityYearRange)}
                  </Typography>
                </Stack>
                {authorityDateFilter !== 'none' && (
                  <Stack
                    direction="row"
                    spacing={0.375}
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ pt: 0.5 }}
                  >
                    {AUTHORITY_YEAR_PRESETS.map((preset) => (
                      <Button
                        key={preset.label}
                        size="small"
                        variant="outlined"
                        disabled={busy}
                        onClick={() => setAuthorityYearRange([preset.start, preset.end])}
                        sx={{
                          py: 0,
                          px: 0.75,
                          minWidth: 0,
                          minHeight: 22,
                          fontSize: '0.6875rem',
                          textTransform: 'none',
                        }}
                      >
                        {preset.label}
                      </Button>
                    ))}
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
                  disabled={busy || !anyCheckedSourceAvailable}
                  onClick={() => void runTagBomb()}
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
              {selectionRange && (
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={limitToSelection}
                      disabled={busy}
                      onChange={(event) => setLimitToSelection(event.target.checked)}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Only the selected text (
                      {(selectionRange.end - selectionRange.start).toLocaleString()} characters)
                    </Typography>
                  }
                  sx={{ ml: 0 }}
                />
              )}
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
                  disabled={busy || !aiReady}
                  onClick={() => void runAi()}
                >
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
