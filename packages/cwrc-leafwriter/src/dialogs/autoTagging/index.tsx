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
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NorbertIcon } from '../../icons/custom/AuthoritySource';
import {
  AutoTaggingSession,
  aiApiSettingsFromDesktop,
  candidatesFromEntityDatabaseRecords,
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
  persistAiPromptProfiles,
  persistValidationSettings,
  readPersistedValidationSettings,
  aiValidationFromSettings,
  defaultAuthorityPacksRecord,
  entityStoreFromDesktop,
  OWN_DATABASE_KIND_BY_PACK_ID,
  persistAuthoritySettings,
  persistAuthorityDateFilter,
  readAiPromptProfilesFromDesktop,
  readPersistedAuthoritySettings,
  readPersistedExclusions,
  persistExclusions,
  emptyExclusions,
  exclusionsHaveContent,
  filterSuggestionsByExclusions,
  nestingPathsToUserRules,
  linesToSurfaces,
  surfacesToLines,
  EXCLUSION_SURFACE_TAGS,
  type AutoTaggingExclusions,
  type ExclusionSurfaceTag,
  readSpreadsheet,
  resolveAutoTaggingSourceLanguage,
  settingsFromUiState,
  uiStateFromSettings,
  AUTHORITY_YEAR_MIN,
  AUTHORITY_YEAR_MAX,
  dateFilterForLookup,
  DEFAULT_AUTHORITY_DATE_FILTER,
  DEFAULT_AUTHORITY_YEAR_RANGE,
  type AiPromptProfilesState,
  type AuthorityPackId,
  type AuthorityPackStringCounts,
  type DateFilterMode,
  AUTHORITY_PACKS,
  AUTHORITY_PACK_SHORT_LABELS,
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
  TAG_BOMB_SCOPES,
  TAG_BOMB_SCOPE_LABEL_KEYS,
  type TagBombScope,
  type TagBombDocumentResult,
  peekTagBombQueue,
  setTagBombQueue,
  consumeTagBombQueueEntry,
  clearTagBombQueue,
  isAiUiFeatureEnabled,
} from '../../autoTagging';
import type { EntityDatabaseCandidateRecord } from '../../autoTagging/ownDatabaseCandidates';
import { SQLITE_REQUIRED_LOOKUP_MESSAGE } from '../../autoTagging/sqliteRequired';
import {
  isChineseLanguageCode,
  isJapaneseLanguageCode,
  isTibetanLanguageCode,
} from '../../utilities/languageCodes';
import { isPluginEnabled } from '../../plugins';
import { AutoTaggingApplyOverlay } from '../../layout/AutoTaggingApplyOverlay';
import { useActions, useAppState } from '../../overmind';
import type { IDialog } from '../type';
import { AiPromptEditorDialog } from './AiPromptEditorDialog';
import { AiTagChipPicker } from './AiTagChipPicker';
import {
  cachedPackReader,
  clearPackContentCache,
  uncachedPackReader,
} from '../../services/authority-pack-lookup';
import { refreshCbdbConcordanceAfterPackLifecycle } from '../../autoTagging/cbdbConcordance';

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

const pluginGatedPackIds = (ids: AuthorityPackId[]): AuthorityPackId[] =>
  ids.filter((id) => {
    if (id === 'norbert-persons' || id === 'norbert-person-wrappers' || id === 'norbert-wiki-nt') {
      return isPluginEnabled('norbert');
    }
    return true;
  });

const visibleAuthorityPackIdsForLanguage = (language: string | null): AuthorityPackId[] =>
  pluginGatedPackIds(
    isJapaneseLanguageCode(language)
      ? [
          'ndl-persons',
          'ndl-places',
          'ndl-orgs',
          'ndl-works',
          'wikidata-persons-ja',
          'wikidata-places-ja',
          'wikidata-orgs-ja',
          'wikidata-works-ja',
        ]
      : isTibetanLanguageCode(language)
        ? [
            'wikidata-persons-bo',
            'bdrc-persons-bo',
            'wikidata-places-bo',
            'bdrc-places-bo',
            'wikidata-orgs-bo',
          ]
        : isChineseLanguageCode(language) || !language
          ? [
              'cbdb-persons',
              'cbdb-places',
              'cbdb-offices',
              'dila-persons',
              'dila-places',
              'chgis-places',
              'wikidata-persons',
              'wikidata-places-zh-hant',
              'wikidata-orgs-zh-hant',
              'wikidata-works-zh-hant',
              'norbert-persons',
              'norbert-person-wrappers',
              'norbert-wiki-nt',
            ]
          : UI_AUTHORITY_PACK_IDS.filter((id) => !id.startsWith('ndl-')),
  );

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

/** Colored badge replacing the "PEDB"/"CEDB" prefix on own-database rows. */
const OWN_DATABASE_BADGE: Partial<
  Record<ReturnType<typeof authorityPackOrigin>, { label: string; color: string; bg: string }>
> = {
  pedb: { label: 'Local', color: '#0b5fa5', bg: '#e3f0fb' },
  cedb: { label: 'Central', color: '#7a3ea1', bg: '#f2e8f8' },
};

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
 * preview but reading from migrated SQLite — one load per database,
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
      for (const id of pedbIds) {
        const kind = OWN_DATABASE_KIND_BY_PACK_ID[id];
        if (!kind) continue;
        const records = await store.sqliteCandidateRecords(kind);
        if (records == null) throw new Error(SQLITE_REQUIRED_LOOKUP_MESSAGE);
        out[id] = countCandidatesUniqueStrings(
          candidatesFromEntityDatabaseRecords(records as EntityDatabaseCandidateRecord[], 'PEDB'),
          range,
        );
      }
    }
  }

  const cedbIds = ids.filter((id) => id in OWN_DATABASE_KIND_BY_PACK_ID && id.startsWith('cedb-'));
  if (cedbIds.length > 0) {
    const store = centralEntityStoreFromDesktop(null);
    if (store) {
      for (const id of cedbIds) {
        const kind = OWN_DATABASE_KIND_BY_PACK_ID[id];
        if (!kind) continue;
        const records = await store.sqliteCandidateRecords(kind);
        if (records == null) throw new Error(SQLITE_REQUIRED_LOOKUP_MESSAGE);
        out[id] = countCandidatesUniqueStrings(
          candidatesFromEntityDatabaseRecords(records as EntityDatabaseCandidateRecord[], 'CEDB'),
          range,
        );
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
  const { t } = useTranslation();
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
  const [aiValidation, setAiValidation] = useState(false);
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
  const [authorityDateFilter, setAuthorityDateFilter] = useState<DateFilterMode>(
    DEFAULT_AUTHORITY_DATE_FILTER,
  );
  const [authorityYearRange, setAuthorityYearRange] = useState<[number, number]>(
    DEFAULT_AUTHORITY_YEAR_RANGE,
  );
  const cycleAuthorityDateFilter = () => {
    setAuthorityDateFilter((mode) => {
      const next = mode === 'none' ? 'limit' : mode === 'limit' ? 'exclude' : 'none';
      void persistAuthorityDateFilter(next, authorityYearRange);
      return next;
    });
  };
  const commitAuthorityYearRange = (range: [number, number]) => {
    setAuthorityYearRange(range);
    void persistAuthorityDateFilter(authorityDateFilter, range);
  };
  const [importedLists, setImportedLists] = useState<TagBombImportedList[]>([]);
  const [tagBombScope, setTagBombScope] = useState<TagBombScope>('currentFile');
  const [tagBombCustomPath, setTagBombCustomPath] = useState('');
  const [skipReview, setSkipReview] = useState(false);
  const [tagBombQueue, setTagBombQueueLocal] = useState<TagBombDocumentResult[] | null>(null);
  const [queueBusyPath, setQueueBusyPath] = useState<string | null>(null);
  const [shortFormFromFirstAppearance, setShortFormFromFirstAppearance] = useState(true);
  const [exclusionsOpen, setExclusionsOpen] = useState(false);
  const [exclusionsDraft, setExclusionsDraft] = useState<AutoTaggingExclusions>(emptyExclusions);
  const [exclusionsActive, setExclusionsActive] = useState(false);
  const [busyMessage, setBusyMessage] = useState('');
  const [authorityPackCounts, setAuthorityPackCounts] = useState<AuthorityPackStringCounts>({});
  const [authorityPackCountsLoading, setAuthorityPackCountsLoading] = useState(false);
  const [showPackStringCounts, setShowPackStringCounts] = useState(false);
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
  const { enableMultiFileAutomation, multiFileSnapshotBefore } = useAppState().editor;

  // Opening the launcher abandons any in-progress review or disambiguation
  // walk without saving — the new run starts from a clean slate.
  useEffect(() => {
    if (open) dismissReviewPanes();
  }, [open, dismissReviewPanes]);

  // Offer to resume a multi-document tag bomb queue left over from a prior run.
  useEffect(() => {
    if (open) setTagBombQueueLocal(peekTagBombQueue());
  }, [open]);

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
    setShowPackStringCounts(saved.showPackStringCounts);
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
    setAiValidation(aiValidationFromSettings(validationSettings));
    const exclusions = readPersistedExclusions();
    setExclusionsDraft(exclusions);
    setExclusionsActive(exclusionsHaveContent(exclusions));
  }, [open]);

  const applyExclusionsToSuggestions = (produced: Suggestion[]): Suggestion[] =>
    filterSuggestionsByExclusions(produced, readPersistedExclusions());

  const openExclusionsDialog = () => {
    setExclusionsDraft(readPersistedExclusions());
    setExclusionsOpen(true);
  };

  const saveExclusionsDialog = () => {
    persistExclusions(exclusionsDraft);
    setExclusionsActive(exclusionsHaveContent(exclusionsDraft));
    setExclusionsOpen(false);
  };
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
    // Runs when the dialog opens. `refreshWorkflowState` is redefined every
    // render, so naming it would re-run this while the dialog is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (
      !showPackStringCounts ||
      step !== 'authority' ||
      !entityDbFolder ||
      busy ||
      !isDesktopApp()
    ) {
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
        const range = dateFilterForLookup(
          authorityDateFilter === 'none'
            ? undefined
            : {
                mode: authorityDateFilter,
                start: Math.min(yearStart, yearEnd),
                end: Math.max(yearStart, yearEnd),
              },
        );

        try {
          const counts: AuthorityPackStringCounts = {};
          const readPack = cachedPackReader();
          if (readPack) {
            Object.assign(
              counts,
              await countAuthorityPackStrings(
                visibleAuthorityPackIds,
                readPack,
                installedIds,
                range,
              ),
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
    showPackStringCounts,
  ]);
  const beginReview = (
    produced: Suggestion[],
    notice?: string,
    options?: { aiCurate?: boolean },
  ) => {
    startAutoTaggingReview({
      suggestions: applyExclusionsToSuggestions(produced),
      notice,
      aiValidation: Boolean(options?.aiCurate && aiReady && isAiUiFeatureEnabled('tagBombCurate')),
    });
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
    // Prefer the commons bridge: it scaffolds a blank folder and handles the
    // "parent already has entities.xml" case. Falling back to raw IPC would
    // reintroduce the circular "must already have entities.xml" gate.
    const bridgePick = (
      window as Window & {
        __ljbCommonsUi?: { pickEntityDbFolder?: () => Promise<string | null> };
      }
    ).__ljbCommonsUi?.pickEntityDbFolder;
    if (bridgePick) {
      const picked = await bridgePick();
      if (!picked) return;
      await refreshAuthoritySetup();
      return;
    }

    const picked = await window.electronAPI?.pickEntityDbFolder?.();
    if (!picked) return;

    const folder = picked.replace(/[/\\]+$/, '');
    const entitiesHere = await window.electronAPI?.pathExists?.(`${folder}/entities.xml`);
    if (!entitiesHere) {
      try {
        const { createEntitiesScaffold } = await import('../../autoTagging/entities');
        await window.electronAPI?.createEntityDatabase?.(folder, createEntitiesScaffold());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
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
      clearPackContentCache();
      try {
        await refreshCbdbConcordanceAfterPackLifecycle();
      } catch {
        // Install succeeded; panel reload remains the safety net.
      }
      await refreshAuthoritySetup();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runShortFormTag = async () => {
    if (!entityDbFolder) {
      setError('Choose an entity database folder first (App Settings → Entity database).');
      return;
    }

    setError(null);
    setBusy(true);
    setBusyMessage('Finding short-form names…');
    try {
      const result = await getSession().runShortFormTag({
        startFromFirstAppearance: shortFormFromFirstAppearance,
      });
      if (result.suggestions.length === 0) {
        setError(result.notice ?? 'No short-form matches.');
        return;
      }
      const detail =
        result.keyedEntityCount > 0 && result.stringCount > 0
          ? `${result.suggestions.length} short-form hit${result.suggestions.length === 1 ? '' : 's'} from ${result.keyedEntityCount} keyed ${result.keyedEntityCount === 1 ? 'person' : 'people'} (${result.stringCount} seed string${result.stringCount === 1 ? '' : 's'}). Every hit needs review.`
          : undefined;
      beginReview(result.suggestions, detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setBusyMessage('');
    }
  };

  /** Apply one queued document's suggestions directly, bypassing review, and drop it from the queue. */
  const applyQueueDocument = async (doc: TagBombDocumentResult) => {
    setQueueBusyPath(doc.filePath);
    setError(null);
    try {
      const exclusions = readPersistedExclusions();
      const result = await getSession().applyTagBombDocument(
        doc.filePath,
        filterSuggestionsByExclusions(doc.suggestions, exclusions),
        nestingPathsToUserRules(exclusions.nestingPaths),
      );
      notifyViaSnackbar({
        message: t('LW.autoTagging.tag_bomb_queue.applied', { count: result.applied }),
      });
      const remaining = consumeTagBombQueueEntry(doc.filePath);
      setTagBombQueueLocal(remaining);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setQueueBusyPath(null);
    }
  };

  /** Open a queued document (if not already active) and start the familiar single-document review. */
  const reviewQueueDocument = async (doc: TagBombDocumentResult) => {
    setQueueBusyPath(doc.filePath);
    setError(null);
    try {
      if (doc.filePath !== 'current') {
        await window.__leafWriterProject?.openFile?.(doc.filePath);
      }
      const remaining = consumeTagBombQueueEntry(doc.filePath);
      setTagBombQueueLocal(remaining);
      beginReview(doc.suggestions, `${doc.filePath} · ${doc.matchCount} matches`, {
        aiCurate: aiValidation && aiReady,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setQueueBusyPath(null);
    }
  };

  const discardQueue = () => {
    clearTagBombQueue();
    setTagBombQueueLocal(null);
  };

  const runTagBomb = async () => {
    const installedIds = new Set(
      authorityStatus.filter((status) => status.installed).map((status) => status.id),
    );
    const checked = expandAuthorityPackIds(
      visibleAuthorityPackIds.filter((id) => authorityPacks[id]),
    );
    const originOf = (id: AuthorityPackId) => {
      const spec = AUTHORITY_PACKS.find((p) => p.id === id);
      return spec ? authorityPackOrigin(spec) : 'file';
    };
    const selected = checked.filter((id) =>
      originOf(id) === 'file' ? installedIds.has(id) : true,
    );
    if (selected.length === 0) {
      setError('Select at least one source.');
      return;
    }
    const effectiveScope: TagBombScope = enableMultiFileAutomation ? tagBombScope : 'currentFile';
    if (effectiveScope === 'custom' && !tagBombCustomPath.trim()) {
      setError('Enter a folder path.');
      return;
    }
    const needsFileReader = selected.some((id) => originOf(id) === 'file');
    // Tag bomb builds its own seed index and only reads each pack once. Keep
    // raw NDJSON arrays out of the reusable lookup cache while that index is
    // alive; retaining both representations can exceed the renderer's memory
    // limit on large authority bundles.
    const readPack = uncachedPackReader();
    if (needsFileReader && !readPack) {
      setError('Authority pack API is not available.');
      return;
    }

    setError(null);
    setBusy(true);
    setAuthorityProgress('Tagging…');
    try {
      await persistAuthoritySettings(
        settingsFromUiState({
          packs: authorityPacks,
          showPackStringCounts,
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
      const result = await getSession().runTagBomb(selected, readPack ?? (async () => ''), {
        ...(dateFilter ? { dateFilter } : {}),
        importedLists,
        scope: effectiveScope,
        ...(effectiveScope === 'custom' ? { customPath: tagBombCustomPath } : {}),
      });
      const matchedDocs: TagBombDocumentResult[] =
        result.byDocument ??
        (result.suggestions.length > 0
          ? [
              {
                filePath: 'current',
                suggestions: result.suggestions,
                matchCount: result.matchCount,
              },
            ]
          : []);
      if (matchedDocs.length === 0) {
        const filterNote =
          authorityDateFilter === 'none'
            ? ''
            : ` (${Math.min(...authorityYearRange)}–${Math.max(...authorityYearRange)} CE, ${authorityDateFilter})`;
        setError(
          `No untagged matches (${result.candidateCount.toLocaleString()} authority entries after filters${filterNote}).`,
        );
        return;
      }

      // Guardrail: auto-snapshot before a multi-document run, per the configured threshold.
      if (matchedDocs.length > 1) {
        const isCorpusWide = effectiveScope === 'project';
        const shouldSnapshot =
          multiFileSnapshotBefore === 'multiFile' ||
          (multiFileSnapshotBefore === 'corpusWide' && isCorpusWide);
        if (shouldSnapshot) {
          await window.__leafWriterProject?.createTimeMachineSnapshot?.('tag-bomb');
        }
      }

      if (skipReview) {
        setBusyMessage(t('LW.autoTagging.tag_bomb_queue.applying'));
        let appliedTotal = 0;
        const exclusions = readPersistedExclusions();
        const userRules = nestingPathsToUserRules(exclusions.nestingPaths);
        for (const docResult of matchedDocs) {
          const applied = await getSession().applyTagBombDocument(
            docResult.filePath,
            filterSuggestionsByExclusions(docResult.suggestions, exclusions),
            userRules,
          );
          appliedTotal += applied.applied;
        }
        notifyViaSnackbar({
          message: t('LW.autoTagging.tag_bomb_queue.applied', { count: appliedTotal }),
        });
        handleClose();
        return;
      }

      if (matchedDocs.length === 1) {
        beginReview(matchedDocs[0]!.suggestions, undefined, {
          aiCurate: aiValidation && aiReady,
        });
        return;
      }

      setTagBombQueue(matchedDocs);
      setTagBombQueueLocal(matchedDocs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setAuthorityProgress('');
      setBusyMessage('');
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
      else setBusy(true);
      try {
        const client = createLlmClientFromSettings(settings);
        const onProgress = (done: number, total: number) => {
          if (background) updateAiRunProgress(done, total);
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
              message: `${t('LW.autoTagging.aiModeFailed', { mode: aiMode })} ${e instanceof Error ? e.message : String(e)}`,
              options: { variant: 'error' },
            });
          }
        }
      } finally {
        if (background) finishAiRunProgress();
        else setBusy(false);
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
        open={busy && (step === 'ai' || step === 'authority' || busyMessage.length > 0)}
        label={
          step === 'authority'
            ? authorityProgress || 'Loading tag bomb sources…'
            : busyMessage || aiBusyLabel
        }
      />
      <Dialog
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width:
              step === 'methods'
                ? 340
                : step === 'authority'
                  ? { xs: 'calc(100vw - 16px)', sm: 680 }
                  : 380,
            maxWidth: 'calc(100vw - 16px)',
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
                  {methodButton(
                    'Tag bomb',
                    () => openAuthorityStep(),
                    !isDesktopApp(),
                    !isDesktopApp() ? 'Desktop app only' : undefined,
                  )}
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={0.5}
                    sx={{ mb: 0.25, flexWrap: 'wrap' }}
                  >
                    {methodButton(
                      'Short-form names',
                      () => void runShortFormTag(),
                      !isDesktopApp() || !entityDbFolder,
                      !isDesktopApp()
                        ? 'Desktop app only'
                        : !entityDbFolder
                          ? 'Configure an entity database in App Settings'
                          : undefined,
                    )}
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={shortFormFromFirstAppearance}
                          disabled={!isDesktopApp() || !entityDbFolder || busy}
                          onChange={(event) =>
                            setShortFormFromFirstAppearance(event.target.checked)
                          }
                        />
                      }
                      label={
                        <Typography
                          variant="caption"
                          color={
                            !isDesktopApp() || !entityDbFolder ? 'text.disabled' : 'text.primary'
                          }
                        >
                          from first appearance
                        </Typography>
                      }
                      sx={{
                        ml: 0,
                        mr: 0,
                        ...(!isDesktopApp() || !entityDbFolder ? { opacity: 0.6 } : {}),
                      }}
                    />
                  </Stack>
                  {(isAiUiFeatureEnabled('suggest') || isAiUiFeatureEnabled('audit')) &&
                    isDesktopApp() &&
                    !aiReady && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ px: 1, py: 0.125, fontSize: '0.6875rem', lineHeight: 1.35 }}
                      >
                        AI suggest and audit need a tested API connection — configure and test it in
                        Application Settings. AI curate lives on the tag bomb screen.
                      </Typography>
                    )}
                  {isAiUiFeatureEnabled('suggest') &&
                    methodButton(
                      'AI suggest',
                      () => openAiStep('suggest'),
                      aiDisabled,
                      aiDisabledReason,
                    )}
                  {isAiUiFeatureEnabled('audit') &&
                    methodButton(
                      'AI audit',
                      () => openAiStep('audit'),
                      aiDisabled,
                      aiDisabledReason,
                    )}
                </>
              )}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mt: 0.5,
                }}
              >
                <Tooltip title="Exclusions — nesting and string filters">
                  <IconButton
                    size="small"
                    aria-label="Auto-tagging exclusions"
                    onClick={openExclusionsDialog}
                    sx={{ color: 'error.main', opacity: exclusionsActive ? 1 : 0.55, p: 0.25 }}
                  >
                    <FilterAltIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Link component="button" variant="caption" underline="hover" onClick={handleClose}>
                  Close
                </Link>
              </Box>
            </Stack>
          ) : step === 'authority' ? (
            <Stack spacing={0.75} sx={{ mt: 0.25 }}>
              {tagBombQueue && tagBombQueue.length > 0 && (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  {t('LW.autoTagging.tag_bomb_queue.resume_title')}
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                      {t('LW.autoTagging.tag_bomb_queue.resume_body', {
                        count: tagBombQueue.length,
                      })}
                    </Typography>
                    <Stack spacing={0.5}>
                      {tagBombQueue.map((doc) => (
                        <Stack
                          key={doc.filePath}
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {doc.filePath} ·{' '}
                            {t('LW.autoTagging.tag_bomb_queue.hits', { count: doc.matchCount })}
                          </Typography>
                          <Stack direction="row" spacing={0.5} flexShrink={0}>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={queueBusyPath !== null}
                              onClick={() => void reviewQueueDocument(doc)}
                            >
                              {t('LW.autoTagging.tag_bomb_queue.review')}
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              disabled={queueBusyPath !== null}
                              onClick={() => void applyQueueDocument(doc)}
                            >
                              {t('LW.autoTagging.skip_review')}
                            </Button>
                          </Stack>
                        </Stack>
                      ))}
                    </Stack>
                    <Box sx={{ mt: 0.5 }}>
                      <Link
                        component="button"
                        variant="caption"
                        underline="hover"
                        onClick={discardQueue}
                      >
                        {t('LW.autoTagging.tag_bomb_queue.discard')}
                      </Link>
                    </Box>
                  </Box>
                </Alert>
              )}
              {!entityDbFolder && (
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  No entity database folder configured. Choose any folder — a blank one is fine; Le
                  Grognard will set up the database there. Prefer a cloud-synced folder if you use
                  more than one machine.
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
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  {enableMultiFileAutomation && (
                    <FormControl size="small" disabled={busy} sx={{ minWidth: 160 }}>
                      <InputLabel id="tag-bomb-scope-label" sx={{ fontSize: '0.8125rem' }}>
                        {t('LW.autoTagging.tag_bomb_scope.label')}
                      </InputLabel>
                      <Select
                        labelId="tag-bomb-scope-label"
                        label={t('LW.autoTagging.tag_bomb_scope.label')}
                        value={tagBombScope}
                        onChange={(event) => setTagBombScope(event.target.value as TagBombScope)}
                        sx={{ fontSize: '0.8125rem' }}
                      >
                        {TAG_BOMB_SCOPES.map((value) => (
                          <MenuItem key={value} value={value} sx={{ fontSize: '0.8125rem' }}>
                            {t(TAG_BOMB_SCOPE_LABEL_KEYS[value])}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                  {enableMultiFileAutomation && tagBombScope === 'custom' && (
                    <TextField
                      size="small"
                      disabled={busy}
                      placeholder={t('LW.autoTagging.tag_bomb_scope.folder_placeholder')}
                      value={tagBombCustomPath}
                      onChange={(event) => setTagBombCustomPath(event.target.value)}
                      slotProps={{ input: { sx: { fontSize: '0.8125rem' } } }}
                      sx={{ minWidth: 220 }}
                    />
                  )}
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={skipReview}
                        disabled={busy}
                        onChange={(event) => setSkipReview(event.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="caption">{t('LW.autoTagging.skip_review')}</Typography>
                    }
                    sx={{ ml: 0 }}
                  />
                  {isAiUiFeatureEnabled('tagBombCurate') && (
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={aiValidation && aiReady}
                          disabled={aiDisabled || busy}
                          onChange={(event) => {
                            setAiValidation(event.target.checked);
                            void persistValidationSettings({ aiValidation: event.target.checked });
                          }}
                        />
                      }
                      label={
                        <Typography
                          variant="caption"
                          color={aiDisabled ? 'text.disabled' : 'text.primary'}
                        >
                          {t('LW.autoTagging.ai_curate')}
                        </Typography>
                      }
                      title={
                        aiDisabledReason ??
                        'After tagging, score suggestions in the background and filter obviously wrong hits.'
                      }
                      sx={{ ml: 0, ...(aiDisabled ? { opacity: 0.6 } : {}) }}
                    />
                  )}
                </Stack>
              </Box>
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
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  columnGap: 2,
                  rowGap: 0.25,
                  alignItems: 'start',
                }}
              >
                {visibleAuthorityPackGroups.map((group) => {
                  const availableGroupPackIds = group.packs
                    .map((opt) => opt.id)
                    .filter((packId) =>
                      isAuthorityPackAvailable(
                        packId,
                        authorityStatus,
                        entityDbFolder,
                        importedLists.length,
                      ),
                    );
                  const checkedInGroup = availableGroupPackIds.filter(
                    (packId) => authorityPacks[packId],
                  );
                  const groupAllChecked =
                    availableGroupPackIds.length > 0 &&
                    checkedInGroup.length === availableGroupPackIds.length;
                  const groupSomeChecked =
                    checkedInGroup.length > 0 &&
                    checkedInGroup.length < availableGroupPackIds.length;
                  return (
                    <Box key={group.tag} sx={{ minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={0.25}>
                        <Checkbox
                          size="small"
                          checked={groupAllChecked}
                          indeterminate={groupSomeChecked}
                          disabled={busy || availableGroupPackIds.length === 0}
                          title={`Toggle all ${group.label.toLowerCase()}`}
                          onChange={(event) => {
                            const next = event.target.checked;
                            setAuthorityPacks((current) => {
                              const updated = { ...current };
                              for (const packId of availableGroupPackIds) updated[packId] = next;
                              return updated;
                            });
                          }}
                          sx={{ p: 0.25 }}
                        />
                        <Typography variant="caption" sx={authoritySourceHeadingSx}>
                          {group.label}
                        </Typography>
                      </Stack>
                      <Stack spacing={0}>
                        {group.packs.map((opt) => {
                          const origin = authorityPackOrigin(opt);
                          const available = isAuthorityPackAvailable(
                            opt.id,
                            authorityStatus,
                            entityDbFolder,
                            importedLists.length,
                          );
                          const badge = OWN_DATABASE_BADGE[origin];
                          const sourceBadge = opt.source === 'norbert' ? <NorbertIcon /> : null;
                          const rowLabel = badge
                            ? (AUTHORITY_PACK_SHORT_LABELS[opt.id] ?? opt.label)
                            : opt.label;
                          const suffix = available
                            ? origin === 'file' || origin === 'pedb' || origin === 'cedb'
                              ? showPackStringCounts
                                ? formatPackStringCount(
                                    authorityPackCounts,
                                    opt.id,
                                    authorityPackCountsLoading,
                                  )
                                : ''
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
                              label={
                                badge || sourceBadge ? (
                                  <Stack
                                    direction="row"
                                    alignItems="center"
                                    spacing={0.5}
                                    component="span"
                                  >
                                    {sourceBadge ?? (
                                      <Box
                                        component="span"
                                        sx={{
                                          fontSize: '0.625rem',
                                          fontWeight: 700,
                                          lineHeight: 1,
                                          px: 0.5,
                                          py: 0.25,
                                          borderRadius: 0.5,
                                          color: badge!.color,
                                          bgcolor: badge!.bg,
                                        }}
                                      >
                                        {badge!.label}
                                      </Box>
                                    )}
                                    <Box component="span">{`${rowLabel}${suffix}`}</Box>
                                  </Stack>
                                ) : (
                                  `${rowLabel}${suffix}`
                                )
                              }
                              sx={{
                                ...authorityOptionSx,
                                minWidth: 0,
                                '& .MuiFormControlLabel-label': {
                                  ...authorityOptionSx['& .MuiFormControlLabel-label'],
                                  overflowWrap: 'anywhere',
                                },
                              }}
                            />
                          );
                        })}
                      </Stack>
                    </Box>
                  );
                })}
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
                    onChangeCommitted={(_event, value) =>
                      commitAuthorityYearRange(value as [number, number])
                    }
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
                        onClick={() => commitAuthorityYearRange([preset.start, preset.end])}
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
              {isAiUiFeatureEnabled('tagBombCurate') && aiDisabled && isDesktopApp() && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.6875rem', lineHeight: 1.35 }}
                >
                  Configure and test an AI API in Application Settings to enable AI curate.
                </Typography>
              )}
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
      <Dialog
        open={exclusionsOpen}
        onClose={() => setExclusionsOpen(false)}
        PaperProps={{ sx: { width: 420, m: 1, borderRadius: 1 } }}
      >
        <DialogContent sx={{ p: 1.5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Exclusions
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Nesting bans use <code>//ancestor//child</code> (one per line). String bans are exact
            surfaces for each tag — one string per line.
          </Typography>
          <TextField
            label="Nesting (XPath-style)"
            value={exclusionsDraft.nestingPaths.join('\n')}
            onChange={(event) =>
              setExclusionsDraft((current) => ({
                ...current,
                nestingPaths: event.target.value.split(/\r?\n/),
              }))
            }
            multiline
            minRows={3}
            fullWidth
            size="small"
            placeholder={'//persName//title\n//placeName//title'}
            sx={{ mb: 1.5 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Strings by tag
          </Typography>
          <Stack spacing={1}>
            {EXCLUSION_SURFACE_TAGS.map((tag) => (
              <TextField
                key={tag}
                label={tag}
                value={surfacesToLines(exclusionsDraft.surfacesByTag[tag])}
                onChange={(event) => {
                  const surfaces = linesToSurfaces(event.target.value);
                  setExclusionsDraft((current) => {
                    const next: AutoTaggingExclusions = {
                      ...current,
                      surfacesByTag: { ...current.surfacesByTag },
                    };
                    if (surfaces.length === 0)
                      delete next.surfacesByTag[tag as ExclusionSurfaceTag];
                    else next.surfacesByTag[tag as ExclusionSurfaceTag] = surfaces;
                    return next;
                  });
                }}
                multiline
                minRows={1}
                maxRows={4}
                fullWidth
                size="small"
                placeholder={tag === 'placeName' ? '將軍' : undefined}
              />
            ))}
          </Stack>
          <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ mt: 1.5 }}>
            <Link
              component="button"
              variant="caption"
              underline="hover"
              onClick={() => setExclusionsOpen(false)}
            >
              Cancel
            </Link>
            <Link
              component="button"
              variant="caption"
              underline="hover"
              onClick={saveExclusionsDialog}
              sx={{ fontWeight: 600 }}
            >
              Save
            </Link>
          </Stack>
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
