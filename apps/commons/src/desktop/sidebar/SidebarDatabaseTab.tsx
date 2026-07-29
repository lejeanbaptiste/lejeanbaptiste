import AddIcon from '@mui/icons-material/Add';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import MergeIcon from '@mui/icons-material/Merge';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Radio,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ENTITY_KINDS,
  getDatabaseId,
  type AuthorityId,
  type EntityKind,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import { listCentralMappings } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/concordance';
import {
  addEntityName,
  addUserNationality,
  addUserOrigin,
  addUserNobleTitle,
  acceptEntityDateAssertion,
  acceptEntityDescriptionAssertion,
  attachAuthority,
  decoupleAuthority,
  groupFieldAssertions,
  findAuthorityDuplicates,
  listEntities,
  markDuplicateIntentional,
  mergeEntities,
  removeEntityName,
  removeEntityValue,
  removeNobleTitle,
  renameEntityName,
  setEntityDescription,
  setNameType,
  updateNobleTitle,
  setRomanizedName,
  setUserEntityDate,
  setUserWorkAuthors,
  setUserWorkDate,
  rejectEntityAssertion,
  rejectConcordance,
  applyConcordanceAssociations,
  validateEntityAssertion,
  type CentralMergeConflict,
  type DuplicateGroup,
  type ConcordanceAssociation,
  type ConcordanceImportResult,
  type EntityAssertionSummary,
  type EntitySummary,
  type DatePrecision,
  type FieldAssertionGroups,
  normalizeAuthorityValue,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityOps';
import {
  ALL_NAME_TYPES,
  type NameTypeId,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/nameTypes';
import { backfillEntityNames } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/nameBackfill';
import {
  autoSyncEntitiesToCentral,
  autoSyncEntityToCentral,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/autoSync';
import { suggestPersonRomanization } from '../../../../../packages/cwrc-leafwriter/src/plugins/personNameDefaults';
import { cachedPackReader } from '../../../../../packages/cwrc-leafwriter/src/services/authority-pack-lookup';
import { authorityPackLines } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/packLoader';
import {
  centralEntityStoreFromDesktop,
  desktopEntityFileApi,
  entityStoreFromDesktop,
  type EntityStore,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import { readOrMintUserStableId } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/userStableId';
import {
  loadOpenWarnings,
  resolveWarning,
  warningKey,
  type LookupWarning,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/lookupWarnings';
import {
  autoRomanize,
  canAutoRomanize,
  foldForSearch,
} from '../../../../../packages/cwrc-leafwriter/src/utilities/romanize';
import { openExternalUrl } from '../../../../../packages/cwrc-leafwriter/src/utilities/DOM';
import { useActions, useAppState } from '@src/overmind';
import { EntityLookupField, type EntityLookupValue } from '@src/desktop/EntityLookupField';
import { EntityNamesAccordion, type NameRow } from './EntityNamesAccordion';
import { entityLookupDialogAtom } from '@cwrc/leafwriter';
import { getDefaultStore } from 'jotai';
import { RESET } from 'jotai/utils';
import { db } from '../../../../../packages/cwrc-leafwriter/src/db';
import { applyKeyRemapAcrossProjects, type KeyRemapSummary } from '../entityDb/applyKeyRemap';
import { applyPendingCentralOrders, computeMergeDocket, promoteEntities } from '../entityDb/bridge';
import { authorityLookupUrl } from '../entityDb/authorityLinks';
import { BridgeInboxDialog } from './BridgeInboxDialog';
import { MergeDocketDialog } from './MergeDocketDialog';
import { SourceBadges } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/SourceBadges';
import {
  DESKTOP_DATABASE_ENTITY_EVENT,
  DESKTOP_LEFT_PANEL_EVENT,
  DESKTOP_XPATH_SEARCH_EVENT,
  type DesktopDatabaseEntityDetail,
} from '../desktopLeftPanelBridge';
import { canonicalNationalityLabel } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/dynastyCrosswalk';
import { enrichWikidataWorkEntity } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/wikidataWorkDetails';
import {
  extractWikidataId,
  resolveEntityInDocument,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/disambiguationCandidates';

/**
 * Ordinal of a legacy sequential id (`person-000042` → 42); UUID ids have none.
 * TODO(sync Phase 3): default the survivor to the oldest `changed` timestamp
 * instead of id order once Absorb is reworked — for UUID ids the id carries no
 * age. The merge dialog lets the user override this default either way.
 */
const idOrdinal = (id: string): number => {
  const match = id.match(/-(\d+)$/);
  return match ? parseInt(match[1]!, 10) : Number.MAX_SAFE_INTEGER;
};

/** Default merge survivor: lowest sequential ordinal, then lexby id for a stable UUID default. */
const oldestId = (ids: string[]): string =>
  [...ids].sort((a, b) => idOrdinal(a) - idOrdinal(b) || a.localeCompare(b))[0]!;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizedAuthorityRefs = (refs: AuthorityId[]): AuthorityId[] =>
  refs
    .map((ref) => ({ ...ref, value: normalizeAuthorityValue(ref.type, ref.value) }))
    .filter(
      (ref, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.type.toLowerCase() === ref.type.toLowerCase() &&
            candidate.value === ref.value,
        ) === index,
    );

const authoritySourceFromLookupRef = (ref?: string): string | undefined => {
  if (!ref) return undefined;
  if (/wikidata\.org/i.test(ref)) return 'Wikidata';
  if (/dila\.edu\.tw/i.test(ref)) return 'DILA';
  if (/cbdb\.fas\.harvard\.edu/i.test(ref)) return 'CBDB';
  return undefined;
};

const authorityBadgeGroups = (refs: AuthorityId[]): { ref: AuthorityId; count: number }[] => {
  const groups: { ref: AuthorityId; count: number }[] = [];
  for (const ref of refs) {
    const existing = groups.find(
      (group) => group.ref.type.toLowerCase() === ref.type.toLowerCase(),
    );
    if (existing) existing.count += 1;
    else groups.push({ ref, count: 1 });
  }
  return groups;
};

const lookupEntityTypeForKind = (kind: EntityKind): string =>
  kind === 'org' ? 'organization' : kind;

const sortAuthoritiesByPreference = (
  refs: AuthorityId[],
  order: Record<string, string[]>,
  kind: EntityKind,
): AuthorityId[] => {
  const preferred = order[lookupEntityTypeForKind(kind)] ?? [];
  const rank = new Map(preferred.map((authority, index) => [authority.toLowerCase(), index]));
  return refs
    .map((ref, index) => ({ ref, index }))
    .sort(
      (a, b) =>
        (rank.get(a.ref.type.toLowerCase()) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.ref.type.toLowerCase()) ?? Number.MAX_SAFE_INTEGER) || a.index - b.index,
    )
    .map(({ ref }) => ref);
};

type TFn = (key: string) => string;

/** Localization keys for each stored DatePrecision code — the stored XML value stays the English canonical code; only the display text is localized. */
const PRECISION_LABEL_KEYS: Partial<Record<DatePrecision, string>> = {
  'b.': 'precision_b',
  'b. ca.': 'precision_b_ca',
  active: 'precision_active',
  'active ca.': 'precision_active_ca',
  'fl.': 'precision_fl',
  'd.': 'precision_d',
  'd. ca.': 'precision_d_ca',
  'active to': 'precision_active_to',
  'active to ca.': 'precision_active_to_ca',
};

const WORK_TITLE_TYPES: NameTypeId[] = ['primary', 'translation', 'variant'];
type WorkDatePrecision = '' | 'not before' | 'ca.' | 'not after';

const WORK_DATE_START_PRECISION_OPTIONS: WorkDatePrecision[] = ['', 'not before', 'ca.'];
const WORK_DATE_END_PRECISION_OPTIONS: WorkDatePrecision[] = ['', 'not after', 'ca.'];

const neutralActionButtonSx = {
  color: 'text.secondary',
  p: 0.25,
};

const precisionLabel = (precision: string | null | undefined, t: TFn): string => {
  if (!precision) return '';
  const key = PRECISION_LABEL_KEYS[precision as DatePrecision];
  return key ? t(`LWC.desktop.sidebar.database.${key}`) : precision;
};

const scholarlyYear = (year: number, precision: string | null | undefined, t: TFn): string => {
  const label = precisionLabel(precision, t);
  const qualifier = label ? `${label} ` : '';
  const era = t(
    year < 0 ? 'LWC.desktop.sidebar.database.era_bce' : 'LWC.desktop.sidebar.database.era_ce',
  );
  return `${qualifier}${Math.abs(year)} ${era}`;
};

const scholarlyDateRange = (
  startYear: number | null,
  endYear: number | null,
  startPrecision: string | null | undefined,
  endPrecision: string | null | undefined,
  t: TFn,
): string => {
  if (startYear == null && endYear == null) return '—';
  if (startYear == null) return scholarlyYear(endYear!, endPrecision, t);
  if (endYear == null) return scholarlyYear(startYear, startPrecision, t);
  return `${scholarlyYear(startYear, startPrecision, t)}–${scholarlyYear(endYear, endPrecision, t)}`;
};

/** Groups same-value assertions (e.g. CBDB and DILA both asserting "d. 226") into one row. */
interface AssertionValueGroup {
  element: string;
  value: string;
  precision: string | null | undefined;
  keys: string[];
  sources: string[];
}

const groupAssertionsByValue = (
  assertions: EntityAssertionSummary[],
  keyOf: (assertion: EntityAssertionSummary) => string = (assertion) => assertion.value,
): AssertionValueGroup[] => {
  const map = new Map<string, AssertionValueGroup>();
  for (const assertion of assertions) {
    const source = assertion.source?.split(':')[0] ?? 'authority';
    const canonicalValue = keyOf(assertion);
    const groupKey = `${assertion.element} ${canonicalValue}`;
    const existing = map.get(groupKey);
    if (existing) {
      existing.keys.push(assertion.key);
      if (!existing.sources.includes(source)) existing.sources.push(source);
    } else {
      map.set(groupKey, {
        element: assertion.element,
        value: canonicalValue,
        precision: assertion.precision,
        keys: [assertion.key],
        sources: [source],
      });
    }
  }
  return [...map.values()];
};

/** Which database the panel is currently browsing - a pure view switch, unrelated to syncToCentral. */
type DatabaseView = 'project' | 'central';

interface ConfirmState {
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  showSkipDetachOption?: boolean;
  onConfirm: () => void;
}

interface SidebarDatabaseTabProps {
  /** True while this tab is the visible one; triggers a refresh on activation. */
  active?: boolean;
}

type PendingValidationMode = 'assertion' | 'date' | 'description';
interface PendingValidation {
  key: string;
  mode: PendingValidationMode;
}

export const SidebarDatabaseTab = ({ active = false }: SidebarDatabaseTabProps) => {
  const { t, i18n } = useTranslation();
  const { skipEntityDetachConfirm } = useAppState().ui;
  const { setSkipEntityDetachConfirm, notifyViaSnackbar } = useActions().ui;
  const { config } = useAppState().project;
  const syncToCentral = config?.syncToCentral === true;
  const [databaseView, setDatabaseView] = useState<DatabaseView>('project');
  const [store, setStore] = useState<EntityStore | null>(null);
  const [centralStore, setCentralStore] = useState<EntityStore | null>(null);
  const [projectLang, setProjectLang] = useState<string | null>(null);
  const [authorityOrder, setAuthorityOrder] = useState<Record<string, string[]>>({});
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [concordanceConflicts, setConcordanceConflicts] = useState<
    ConcordanceImportResult['conflicts']
  >([]);
  const [warnings, setWarnings] = useState<LookupWarning[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<EntityKind | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [skipDetachChecked, setSkipDetachChecked] = useState(false);
  const [mergeIds, setMergeIds] = useState<string[] | null>(null);
  const [mergeKeepId, setMergeKeepId] = useState<string>('');
  const [editEntity, setEditEntity] = useState<EntitySummary | null>(null);
  const [editCanonicalName, setEditCanonicalName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const nameBeforeRename = useRef('');
  const [editingRomanized, setEditingRomanized] = useState(false);
  const romanizedBeforeEdit = useRef('');
  const [editDescription, setEditDescription] = useState('');
  const [editRomanized, setEditRomanized] = useState('');
  const [editNameTypes, setEditNameTypes] = useState<Record<string, string>>({});
  const [editNameLanguages, setEditNameLanguages] = useState<Record<string, string>>({});
  const [editNewName, setEditNewName] = useState('');
  const [editNewNameType, setEditNewNameType] = useState<string>('');
  const [editNewNameLanguage, setEditNewNameLanguage] = useState('');
  const [pendingValidations, setPendingValidations] = useState<PendingValidation[]>([]);
  const [dateEditing, setDateEditing] = useState(false);
  const [dateBirth, setDateBirth] = useState('');
  const [dateDeath, setDateDeath] = useState('');
  const [dateBirthQualifier, setDateBirthQualifier] = useState<DatePrecision>('');
  const [dateDeathQualifier, setDateDeathQualifier] = useState<DatePrecision>('');
  const [dateBirthBce, setDateBirthBce] = useState(false);
  const [dateDeathBce, setDateDeathBce] = useState(false);
  const [workDateStart, setWorkDateStart] = useState('');
  const [workDateEnd, setWorkDateEnd] = useState('');
  const [workDateStartPrecision, setWorkDateStartPrecision] = useState<WorkDatePrecision>('');
  const [workDateEndPrecision, setWorkDateEndPrecision] = useState<WorkDatePrecision>('');
  const [valuesEditing, setValuesEditing] = useState(false);
  const [namesExpanded, setNamesExpanded] = useState(false);
  const [titlesExpanded, setTitlesExpanded] = useState(false);
  const [rolesExpanded, setRolesExpanded] = useState(false);
  const [newTitle, setNewTitle] = useState({
    dynasty: '',
    fief: '',
    posthumousName: '',
    title: '',
  });
  const [lastSummary, setLastSummary] = useState<KeyRemapSummary | null>(null);
  const [bridgeOpen, setBridgeOpen] = useState(false);
  const [docketOpen, setDocketOpen] = useState(false);
  const [docketCount, setDocketCount] = useState(0);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{
    done: number;
    total: number;
    entityLabel?: string;
  } | null>(null);
  const backfillAbortRef = useRef<AbortController | null>(null);
  /** Guards against overlapping bulk catch-up sync passes across successive reload() calls. */
  const bulkSyncInFlightRef = useRef(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    const currentStore = entityStoreFromDesktop();
    setStore(currentStore);
    try {
      const globals = window as unknown as {
        __leafWriterProject?: { getProjectSourceLanguage?: () => Promise<string | null> };
      };
      setProjectLang((await globals.__leafWriterProject?.getProjectSourceLanguage?.()) ?? null);
    } catch {
      setProjectLang(null);
    }
    try {
      const preferences = await db.lookupServicePreferences.toArray();
      const nextOrder: Record<string, string[]> = {};
      for (const preference of preferences.sort((a, b) => a.priority - b.priority)) {
        (nextOrder[preference.entityType] ??= []).push(preference.authorityId);
      }
      setAuthorityOrder(nextOrder);
    } catch {
      setAuthorityOrder({});
    }
    if (!currentStore) {
      setEntities([]);
      setDuplicates([]);
      setConcordanceConflicts([]);
      setWarnings([]);
      setCentralStore(null);
      setDocketCount(0);
      return;
    }
    const centralFolder =
      (await window.electronAPI?.getEntityDbFolder?.().catch(() => null)) ?? null;
    const resolvedCentralStore = centralEntityStoreFromDesktop(centralFolder);
    setCentralStore(resolvedCentralStore);

    // Reconcile this project's ljb-central mappings on every open/visit: pick up
    // upstream central merges/deletes, then promote+link any PEDB entity that
    // isn't mapped yet (idempotent - promoteToCentral no-ops once linked). This
    // is the only place this can happen when syncToCentral is on, since that
    // flag hides the manual Bridge button (see the toolbar below).
    if (syncToCentral && resolvedCentralStore && !bulkSyncInFlightRef.current) {
      bulkSyncInFlightRef.current = true;
      void (async () => {
        try {
          const api = desktopEntityFileApi();
          if (!api) return;
          const { id: userStableId } = await readOrMintUserStableId(api, centralFolder);
          const bridgeCtx = {
            projectStore: currentStore,
            centralStore: resolvedCentralStore,
            userStableId,
          };
          await applyPendingCentralOrders(bridgeCtx);
          const pedbIds = listEntities(await currentStore.loadEntities()).map(
            (entity) => entity.id,
          );
          await promoteEntities(bridgeCtx, pedbIds);
        } catch (error) {
          // Best-effort: a manual edit's own auto-sync still covers that entity.
          // eslint-disable-next-line no-console
          console.error('[bridge] catch-up sync on project open failed:', error);
        } finally {
          bulkSyncInFlightRef.current = false;
        }
      })();
    }

    // Pure view switch: browse either database, never both at once - Project
    // falls back from Central if no central folder is configured yet.
    const activeStore =
      databaseView === 'central' && resolvedCentralStore ? resolvedCentralStore : currentStore;

    // Viewing Central means activeStore.loadEntities() below already parses the
    // same doc the docket needs - kick the docket off only once that doc is in
    // hand instead of re-parsing central entities.xml a second time in parallel.
    if (resolvedCentralStore && activeStore !== resolvedCentralStore) {
      computeMergeDocket(resolvedCentralStore)
        .then((docket) => setDocketCount(docket.length))
        .catch(() => setDocketCount(0));
    } else if (!resolvedCentralStore) {
      setDocketCount(0);
    }

    setLoading(true);
    setLoadError(null);
    try {
      const doc = await activeStore.loadEntities();
      if (resolvedCentralStore && activeStore === resolvedCentralStore) {
        computeMergeDocket(resolvedCentralStore, doc)
          .then((docket) => setDocketCount(docket.length))
          .catch(() => setDocketCount(0));
      }
      let conflicts: ConcordanceImportResult['conflicts'] = [];
      if (activeStore === currentStore) {
        const readPack = cachedPackReader();
        if (readPack) {
          try {
            const content = await readPack('cbdb-concordance');
            const associations = authorityPackLines(content)
              .map((line) => {
                try {
                  return JSON.parse(line) as ConcordanceAssociation;
                } catch {
                  return null;
                }
              })
              .filter((row): row is ConcordanceAssociation =>
                Boolean(row?.source && row.canonicalId && row.mergedFromId),
              );
            const imported = applyConcordanceAssociations(doc, associations);
            conflicts = imported.conflicts;
            if (imported.applied > 0) await currentStore.saveEntities(doc);
          } catch {
            // Older installations may not yet have the concordance file.
          }
        }
      }
      setEntities(listEntities(doc));
      // Duplicate-authority detection and lookup warnings are project-only concerns.
      setDuplicates(activeStore === currentStore ? findAuthorityDuplicates(doc) : []);
      setConcordanceConflicts(activeStore === currentStore ? conflicts : []);
      setWarnings(activeStore === currentStore ? await loadOpenWarnings(currentStore) : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [databaseView, syncToCentral]);

  // Load on mount and refresh whenever the tab becomes visible (the project —
  // and with it the entity store — may not exist yet at app start).
  useEffect(() => {
    if (active || !store) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reload]);

  useEffect(() => {
    const handleShowEntity = (event: Event) => {
      const detail = (event as CustomEvent<DesktopDatabaseEntityDetail>).detail;
      if (!detail?.id) return;

      const type = detail.type === 'org' || detail.type === 'organization' ? 'org' : detail.type;
      setDatabaseView('project');
      setKindFilter(type as EntityKind);
      setSearch(`^${escapeRegExp(detail.id)}$`);
      setSelected(new Set([detail.id]));
      window.dispatchEvent(
        new CustomEvent(DESKTOP_LEFT_PANEL_EVENT, { detail: { tab: 'database' } }),
      );
      requestAnimationFrame(() => searchInputRef.current?.focus());
    };

    window.addEventListener(DESKTOP_DATABASE_ENTITY_EVENT, handleShowEntity);
    return () => window.removeEventListener(DESKTOP_DATABASE_ENTITY_EVENT, handleShowEntity);
  }, []);

  // Reload when either database changes on disk (external edit or another flow).
  useEffect(() => {
    if (!window.electronAPI?.onExternalFileChange || !store) return;
    const watchedPaths = new Set(
      [store.entitiesPath, centralStore?.entitiesPath]
        .filter((path): path is string => Boolean(path))
        .map((path) => path.replace(/\\/g, '/')),
    );
    return window.electronAPI.onExternalFileChange((filePath: string) => {
      if (watchedPaths.has(filePath.replace(/\\/g, '/'))) void reload();
    });
  }, [reload, store, centralStore]);

  const { regex, regexError } = useMemo(() => {
    const trimmed = search.trim();
    if (!trimmed) return { regex: null, regexError: null };
    try {
      return { regex: new RegExp(trimmed, 'iu'), regexError: null };
    } catch (error) {
      return {
        regex: null,
        regexError: error instanceof Error ? error.message : 'Invalid expression',
      };
    }
  }, [search]);

  type KindFilterOption = { value: EntityKind | 'all'; label: string };

  const kindFilterOptions = useMemo(
    (): KindFilterOption[] => [
      { value: 'all', label: t('LWC.desktop.sidebar.database.entity_types.all') },
      { value: 'person', label: t('LWC.desktop.sidebar.database.entity_types.person') },
      { value: 'place', label: t('LWC.desktop.sidebar.database.entity_types.place') },
      { value: 'org', label: t('LWC.desktop.sidebar.database.entity_types.organization') },
      { value: 'work', label: t('LWC.desktop.sidebar.database.entity_types.work') },
      { value: 'office', label: t('LWC.desktop.sidebar.database.entity_types.office') },
    ],
    [t],
  );

  const selectedKindOption =
    kindFilterOptions.find((option) => option.value === kindFilter) ?? kindFilterOptions[0];

  /**
   * Romanization shown under the display name: the stored -Latn name, or an
   * on-the-fly autogeneration for legacy entities (also searchable below).
   */
  const romanizedOf = useCallback(
    (entity: EntitySummary): string | null =>
      entity.romanized ?? autoRomanize(entity.names[0] ?? '', projectLang),
    [projectLang],
  );

  /**
   * Script-insensitive search blob per entity: "zhangheng" matches "Zhāng
   * Héng", "Zhang Heng", and (via stored/generated romanization) 張衡.
   */
  const foldedIndex = useMemo(() => {
    const index = new Map<string, string>();
    for (const entity of entities) {
      const romanizations = [
        entity.romanized ?? '',
        ...entity.names.map((name) => autoRomanize(name, projectLang) ?? ''),
      ];
      index.set(
        entity.id,
        foldForSearch(
          [entity.id, ...entity.names, entity.description ?? '', ...romanizations].join('\n'),
        ),
      );
    }
    return index;
  }, [entities, projectLang]);

  const visible = useMemo(() => {
    const folded = foldForSearch(search.trim());
    return entities.filter((entity) => {
      if (kindFilter !== 'all' && entity.kind !== kindFilter) return false;
      if (!regex && !folded) return true;
      const haystacks = [entity.id, ...entity.names, entity.description ?? ''];
      if (regex && haystacks.some((text) => regex.test(text))) return true;
      return Boolean(folded) && (foldedIndex.get(entity.id) ?? '').includes(folded);
    });
  }, [entities, foldedIndex, kindFilter, regex, search]);

  const toggleSelected = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Whichever database is currently being browsed - every visible row belongs to it. */
  const resolveStoreFor = useCallback(
    (_id: string): EntityStore | null => (databaseView === 'central' ? centralStore : store),
    [centralStore, databaseView, store],
  );

  /** Active entity store for list/browse mutations (project PEDB or central CEDB view). */
  const activeStore = useMemo(
    () => (databaseView === 'central' && centralStore ? centralStore : store),
    [centralStore, databaseView, store],
  );

  /**
   * Pull typed names (字/名/… and Wikidata claims) onto person entities from
   * installed authority packs + live Wikidata. Non-destructive: never overwrites
   * an existing `@type` on a name element.
   */
  const runNameBackfill = useCallback(
    async (entityIds?: string[]) => {
      if (!activeStore || backfillBusy) return;
      const controller = new AbortController();
      backfillAbortRef.current = controller;
      setBackfillBusy(true);
      setBackfillProgress({ done: 0, total: 0 });
      try {
        const doc = await activeStore.loadEntities();
        const readPack = cachedPackReader();
        const result = await backfillEntityNames(doc, {
          entityIds,
          readPackFile: readPack,
          projectLang,
          desktopLanguage: i18n.language,
          signal: controller.signal,
          onProgress: (progress) =>
            setBackfillProgress({
              done: progress.done,
              total: progress.total,
              entityLabel: progress.entityLabel,
            }),
        });
        if (entityIds && entityIds.length > 0 && activeStore === store) {
          await autoSyncEntitiesToCentral(doc, entityIds);
        }
        await activeStore.saveEntities(doc);
        if (entityIds?.length === 1) {
          const refreshed = listEntities(doc).find((entity) => entity.id === entityIds[0]);
          if (refreshed && editEntity?.id === refreshed.id) {
            setEditEntity(refreshed);
            setEditNameTypes(
              Object.fromEntries(
                refreshed.nameEntries.map((entry) => [entry.text, entry.type ?? '']),
              ),
            );
          }
        }
        await reload();
        const scope =
          entityIds?.length === 1 ? 'this person' : `${result.entitiesScanned} linked persons`;
        notifyViaSnackbar({
          message: result.cancelled
            ? `Backfill cancelled — added ${result.namesAdded} name${result.namesAdded === 1 ? '' : 's'} across ${result.entitiesUpdated} entit${result.entitiesUpdated === 1 ? 'y' : 'ies'}.`
            : `Backfill complete for ${scope}: added ${result.namesAdded} name${result.namesAdded === 1 ? '' : 's'} across ${result.entitiesUpdated} entit${result.entitiesUpdated === 1 ? 'y' : 'ies'}.` +
              (result.skippedNoAuthority > 0
                ? ` Skipped ${result.skippedNoAuthority} person${result.skippedNoAuthority === 1 ? '' : 's'} with no authority id.`
                : ''),
          options: { variant: result.cancelled ? 'warning' : 'success' },
        });
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        backfillAbortRef.current = null;
        setBackfillBusy(false);
        setBackfillProgress(null);
      }
    },
    [
      activeStore,
      backfillBusy,
      editEntity?.id,
      i18n.language,
      notifyViaSnackbar,
      projectLang,
      reload,
      store,
    ],
  );

  /**
   * Run a mutation against the entity file: load fresh, mutate, save, then
   * optionally propagate a key remap across every registered project.
   * `targetStore` is resolved by the caller from the entity/entities being
   * touched - it's the PEDB store for ordinary rows, or the central store for
   * a CEDB-only row shown here because syncToCentral merged it in.
   */
  const runMutation = useCallback(
    async (
      targetStore: EntityStore | null,
      message: string,
      mutate: (
        doc: Document,
      ) => Record<string, string | null> | void | Promise<Record<string, string | null> | void>,
      /** Entity ids still present after `mutate` that should sync to central before saving (PEDB only). */
      syncIds?: string[],
    ) => {
      if (!targetStore) return;
      setBusyMessage(message);
      try {
        const doc = await targetStore.loadEntities();
        const dbId = getDatabaseId(doc) ?? undefined;
        const remap = (await mutate(doc)) ?? undefined;
        if (syncIds && syncIds.length > 0 && targetStore === store) {
          await autoSyncEntitiesToCentral(doc, syncIds);
        }
        await targetStore.saveEntities(doc);
        if (remap && Object.keys(remap).length > 0) {
          // Durable order first (so a crash mid-crawl still lets other checkouts
          // converge), then the eager cross-project crawl for this machine.
          await targetStore.recordEntityOrder(remap, dbId);
          const summary = await applyKeyRemapAcrossProjects(targetStore, remap);
          setLastSummary(summary);
        }
        setSelected(new Set());
        await reload();
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        setBusyMessage(null);
      }
    },
    [reload, store],
  );

  /**
   * Run a mutation scoped to the entity currently open in the edit dialog:
   * load fresh, mutate, save, refresh both the background list and the
   * dialog's own snapshot (so the names list updates immediately without
   * closing the dialog), then reload in the background.
   */
  const runEntityMutation = useCallback(
    async (message: string, mutate: (doc: Document) => void) => {
      if (!editEntity) return;
      const targetStore = resolveStoreFor(editEntity.id);
      if (!targetStore) return;
      const entityId = editEntity.id;
      setBusyMessage(message);
      try {
        const doc = await targetStore.loadEntities();
        mutate(doc);
        if (targetStore === store) await autoSyncEntityToCentral(doc, entityId);
        await targetStore.saveEntities(doc);
        const refreshed = listEntities(doc).find((entity) => entity.id === entityId) ?? null;
        setEditEntity(refreshed);
        if (refreshed) {
          setEditNameTypes(
            Object.fromEntries(
              refreshed.nameEntries.map((entry) => [entry.text, entry.type ?? '']),
            ),
          );
        }
        await reload();
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        setBusyMessage(null);
      }
    },
    [editEntity, reload, resolveStoreFor, store],
  );

  const runEntityMutationForId = useCallback(
    async (entityId: string, message: string, mutate: (doc: Document, id: string) => void) => {
      const targetStore = resolveStoreFor(entityId);
      if (!targetStore) return;
      setBusyMessage(message);
      try {
        const doc = await targetStore.loadEntities();
        mutate(doc, entityId);
        if (targetStore === store) await autoSyncEntityToCentral(doc, entityId);
        await targetStore.saveEntities(doc);
        const refreshed = listEntities(doc).find((entity) => entity.id === entityId) ?? null;
        if (editEntity?.id === entityId) setEditEntity(refreshed);
        await reload();
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        setBusyMessage(null);
      }
    },
    [editEntity?.id, reload, resolveStoreFor, store],
  );

  /** Merge button: <2 selected extends the search with an alternation, ≥2 opens the merge dialog. */
  const handleMergeClick = () => {
    if (selected.size >= 2) {
      const ids = [...selected];
      setMergeIds(ids);
      setMergeKeepId(oldestId(ids));
      return;
    }
    setSearch((previous) => `${previous}|`);
    searchInputRef.current?.focus();
  };

  const confirmMerge = () => {
    if (!mergeIds || !mergeKeepId) return;
    const dropIds = mergeIds.filter((id) => id !== mergeKeepId);
    const targetStore = resolveStoreFor(mergeKeepId);
    // A conflict only matters for a PEDB merge: it's the signal that two
    // *central* entities might also be duplicates (see mergeEntities). A
    // central-to-central merge has no PEDB counterpart to raise a suggestion for.
    const isProjectMerge = targetStore === store;
    setMergeIds(null);

    let sourceDbId: string | null = null;
    let centralConflicts: CentralMergeConflict[] = [];
    void runMutation(
      targetStore,
      'Merging entities…',
      (doc) => {
        sourceDbId = getDatabaseId(doc);
        const result = mergeEntities(doc, mergeKeepId, dropIds);
        centralConflicts = result.centralConflicts;
        return result.remap;
      },
      [mergeKeepId],
    ).then(async () => {
      if (!isProjectMerge || !centralStore || centralConflicts.length === 0) return;
      for (const conflict of centralConflicts) {
        await centralStore
          .recordMergeSuggestion(sourceDbId ?? 'unknown', [
            conflict.keptCentralId,
            conflict.droppedCentralId,
          ])
          .catch(() => undefined);
      }
      computeMergeDocket(centralStore)
        .then((docket) => setDocketCount(docket.length))
        .catch(() => undefined);
    });
  };

  const requestDetach = (entity: EntitySummary, ref: AuthorityId) => {
    const detach = () =>
      void runMutation(
        resolveStoreFor(entity.id),
        'Detaching authority…',
        (doc) => {
          decoupleAuthority(doc, entity.id, ref);
        },
        [entity.id],
      );
    if (skipEntityDetachConfirm) {
      detach();
      return;
    }
    setSkipDetachChecked(false);
    setConfirm({
      title: `Detach ${ref.type} from ${entity.names[0] ?? entity.id}?`,
      body: `The ${ref.type} identifier will be removed from this entity. Documents are not touched.`,
      confirmLabel: 'Detach',
      showSkipDetachOption: true,
      onConfirm: detach,
    });
  };

  const openEdit = (entity: EntitySummary) => {
    const suggestedRomanized =
      entity.romanized ??
      (entity.kind === 'person'
        ? suggestPersonRomanization(entity.names[0] ?? '', projectLang)
        : null);
    setEditEntity(entity);
    setEditCanonicalName(entity.names[0] ?? '');
    setEditingName(false);
    setEditingRomanized(false);
    setEditDescription(entity.description ?? '');
    setEditRomanized(suggestedRomanized ?? '');
    const workDate = entity.workDate;
    const birthAssertion = entity.assertions.find(
      (assertion) => assertion.element === 'birth' && assertion.origin === 'user',
    );
    const deathAssertion = entity.assertions.find(
      (assertion) => assertion.element === 'death' && assertion.origin === 'user',
    );
    setDateBirth(entity.startYear != null ? String(Math.abs(entity.startYear)) : '');
    setDateDeath(entity.endYear != null ? String(Math.abs(entity.endYear)) : '');
    setDateBirthBce(entity.startYear != null && entity.startYear < 0);
    setDateDeathBce(entity.endYear != null && entity.endYear < 0);
    setDateBirthQualifier((birthAssertion?.precision as DatePrecision) ?? '');
    setDateDeathQualifier((deathAssertion?.precision as DatePrecision) ?? '');
    setWorkDateStart(
      workDate?.startYear != null
        ? String(Math.abs(workDate.startYear))
        : entity.startYear != null
          ? String(Math.abs(entity.startYear))
          : '',
    );
    setWorkDateEnd(
      workDate?.endYear != null
        ? String(Math.abs(workDate.endYear))
        : entity.endYear != null
          ? String(Math.abs(entity.endYear))
          : '',
    );
    setWorkDateStartPrecision((workDate?.startPrecision as WorkDatePrecision) ?? '');
    setWorkDateEndPrecision((workDate?.endPrecision as WorkDatePrecision) ?? '');
    setDateEditing(false);
    setValuesEditing(false);
    setPendingValidations([]);
    setEditNameTypes(
      Object.fromEntries(entity.nameEntries.map((entry) => [entry.text, entry.type ?? ''])),
    );
    setEditNameLanguages(
      Object.fromEntries(
        entity.nameEntries
          .filter((entry) => entry.lang)
          .map((entry) => [entry.text, entry.lang!] as const),
      ),
    );
    setEditNewName('');
    setEditNewNameType('');
    setEditNewNameLanguage('');
    setNamesExpanded(false);
    setTitlesExpanded(false);
    setNewTitle({ dynasty: '', fief: '', posthumousName: '', title: '' });
  };

  const queueValidation = useCallback(
    (keys: string[], mode: PendingValidationMode = 'assertion') => {
      if (!editEntity || keys.length === 0) return;
      setPendingValidations((previous) => {
        const existing = new Set(previous.map((item) => `${item.mode}\0${item.key}`));
        const additions = keys
          .filter((key) => !existing.has(`${mode}\0${key}`))
          .map((key) => ({ key, mode }));
        return additions.length > 0 ? [...previous, ...additions] : previous;
      });
      setEditEntity((previous) =>
        previous
          ? {
              ...previous,
              assertions: previous.assertions.map((assertion) =>
                keys.includes(assertion.key)
                  ? { ...assertion, origin: 'user' as const, status: 'active' as const }
                  : assertion,
              ),
            }
          : previous,
      );
    },
    [editEntity],
  );

  const openEntityLookup = (entity: EntitySummary) => {
    const lookupStore = getDefaultStore();
    lookupStore.set(entityLookupDialogAtom, {
      isUserAuthenticated: window.writer?.overmindState?.user?.uri !== '#anonymous',
      query: entity.names[0] ?? '',
      type: entity.kind === 'org' ? 'organization' : entity.kind,
      onClose: (response) => {
        lookupStore.set(entityLookupDialogAtom, RESET);
        if (!response || response.repository === 'entity-database') return;
        void runEntityMutationForId(entity.id, 'Linking authority…', (doc, id) => {
          attachAuthority(doc, id, { type: response.repository, value: response.uri });
        });
      },
    });
  };

  const refreshWorkDetails = async (entity: EntitySummary) => {
    const wikidata = entity.authorities.find((ref) => ref.type.toLowerCase() === 'wikidata');
    const qid = extractWikidataId(wikidata?.value ?? '');
    if (!qid) return;
    const targetStore = resolveStoreFor(entity.id);
    if (!targetStore) return;
    await runMutation(
      targetStore,
      'Refreshing work details…',
      async (doc) => {
        const details = await enrichWikidataWorkEntity(
          doc,
          entity.id,
          qid,
          projectLang,
          i18n.language,
        );
        if (details && targetStore === store) {
          await autoSyncEntitiesToCentral(
            doc,
            details.authors.map((author) => author.entityId),
          );
        }
      },
      [entity.id],
    );
  };

  const startRename = () => {
    nameBeforeRename.current = editCanonicalName;
    setEditingName(true);
  };

  const acceptRename = () => {
    const trimmed = editCanonicalName.trim();
    setEditCanonicalName(trimmed || nameBeforeRename.current);
    setEditingName(false);
  };

  const cancelRename = () => {
    setEditCanonicalName(nameBeforeRename.current);
    setEditingName(false);
  };

  const startRomanizedEdit = () => {
    romanizedBeforeEdit.current = editRomanized;
    setEditingRomanized(true);
  };

  const acceptRomanizedEdit = () => {
    setEditRomanized((value) => value.trim());
    setEditingRomanized(false);
  };

  const cancelRomanizedEdit = () => {
    setEditRomanized(romanizedBeforeEdit.current);
    setEditingRomanized(false);
  };

  const saveEdit = () => {
    if (!editEntity) return;
    const id = editEntity.id;
    const validations = pendingValidations;
    const canonicalName = editCanonicalName.trim();
    const description = editDescription;
    const romanized = editRomanized.trim();
    const romanizedChanged = romanized !== (editEntity.romanized ?? '');
    setEditEntity(null);
    setPendingValidations([]);
    void runMutation(
      resolveStoreFor(id),
      'Saving entity…',
      (doc) => {
        for (const validation of validations) {
          if (validation.mode === 'date') acceptEntityDateAssertion(doc, id, validation.key);
          else if (validation.mode === 'description') {
            acceptEntityDescriptionAssertion(doc, id, validation.key);
          } else validateEntityAssertion(doc, id, validation.key);
        }
        if (canonicalName) renameEntityName(doc, id, canonicalName);
        setEntityDescription(doc, id, description);
        if (romanizedChanged) setRomanizedName(doc, id, romanized, projectLang);
      },
      [id],
    );
  };

  const saveDates = () => {
    if (!editEntity) return;
    const parseYear = (value: string, bce: boolean): number | null => {
      const number = Number(value.trim());
      if (!value.trim() || !Number.isInteger(number) || number < 0) return null;
      return bce ? -number : number;
    };
    const birth = parseYear(dateBirth, dateBirthBce);
    const death = dateBirthQualifier === 'fl.' ? null : parseYear(dateDeath, dateDeathBce);
    setDateEditing(false);
    void runEntityMutationForId(editEntity.id, 'Saving dates…', (doc, id) => {
      setUserEntityDate(doc, id, 'birth', birth, dateBirthQualifier);
      setUserEntityDate(doc, id, 'death', death, dateDeathQualifier);
    });
  };

  const saveWorkDates = () => {
    if (!editEntity) return;
    const parseYear = (value: string): number | null => {
      const number = Number(value.trim());
      return value.trim() && Number.isInteger(number) && number >= 0 ? number : null;
    };
    setDateEditing(false);
    void runEntityMutationForId(editEntity.id, 'Saving dates…', (doc, id) =>
      setUserWorkDate(
        doc,
        id,
        parseYear(workDateStart),
        parseYear(workDateEnd),
        workDateStartPrecision || null,
        workDateEndPrecision || null,
      ),
    );
  };

  /** One tab-aligned row: label only on the first line of a field, blank thereafter. */
  interface GridRow {
    key: string;
    label: string;
    value: ReactNode;
    trailing?: ReactNode;
  }

  // All of this only depends on editEntity/dateEditing/databaseView, not on
  // unrelated component state (search text, in-progress name/description edits, …) — memoized
  // so typing elsewhere in the dialog doesn't rebuild these rows (and their embedded
  // Tooltip/IconButton elements) on every keystroke.
  const {
    dateGridRows,
    nationalityGridRows,
    originGridRows,
    descriptionGroups,
    nameRows,
    roleRows,
  } = useMemo(() => {
    const dateAssertions =
      editEntity?.assertions.filter(
        (assertion) =>
          (assertion.element === 'birth' || assertion.element === 'death') &&
          assertion.origin === 'authority' &&
          assertion.status === 'active',
      ) ?? [];
    const dateYear = (assertion: EntityAssertionSummary | undefined): number | null => {
      if (!assertion) return null;
      const value = Number(assertion.value);
      return Number.isFinite(value) ? value : null;
    };
    const userBirthAssertion = editEntity?.assertions.find(
      (assertion) =>
        assertion.element === 'birth' &&
        assertion.origin === 'user' &&
        assertion.status === 'active',
    );
    const userDeathAssertion = editEntity?.assertions.find(
      (assertion) =>
        assertion.element === 'death' &&
        assertion.origin === 'user' &&
        assertion.status === 'active',
    );
    const userBirthYear = dateYear(userBirthAssertion) ?? editEntity?.startYear ?? null;
    const userDeathYear = dateYear(userDeathAssertion) ?? editEntity?.endYear ?? null;
    const workDate = editEntity?.kind === 'work' ? editEntity.workDate : null;
    const pendingDateAssertions = dateAssertions.filter((assertion) => {
      const current = assertion.element === 'birth' ? userBirthYear : userDeathYear;
      return assertion.status === 'active' && (current == null || dateYear(assertion) !== current);
    });
    const agreeingDateSources = Array.from(
      new Set(
        dateAssertions
          .filter((assertion) => {
            const current = assertion.element === 'birth' ? userBirthYear : userDeathYear;
            return (
              assertion.status === 'active' && current != null && dateYear(assertion) === current
            );
          })
          .map((assertion) => assertion.source?.split(':')[0])
          .filter((source): source is string => Boolean(source)),
      ),
    );

    const nationalityAssertions =
      editEntity?.assertions.filter((assertion) => assertion.element === 'nationality') ?? [];
    const nationalityKeyOf = (assertion: EntityAssertionSummary): string =>
      canonicalNationalityLabel(assertion.source, assertion.ref, assertion.value);
    const nationalityGroups = groupFieldAssertions(
      nationalityAssertions,
      new Set(editEntity?.nationalities ?? []),
      false,
      nationalityKeyOf,
    );
    const originAssertions =
      editEntity?.assertions.filter((assertion) => assertion.element === 'placeName') ?? [];
    const originGroups = groupFieldAssertions(
      originAssertions,
      new Set(editEntity?.placesOfOrigin ?? []),
      false,
    );
    /** Distinct agreeing sources per current value, so each row gets its own badge. */
    const sourcesForValue = (
      assertions: EntityAssertionSummary[],
      value: string,
      keyOf: (assertion: EntityAssertionSummary) => string = (assertion) => assertion.value,
    ): string[] =>
      Array.from(
        new Set(
          assertions
            .filter(
              (assertion) =>
                assertion.status === 'active' &&
                Boolean(assertion.source) &&
                keyOf(assertion) === value,
            )
            .map((assertion) => assertion.source?.split(':')[0])
            .filter((source): source is string => Boolean(source)),
        ),
      );

    /** Every active assertion key backing a displayed value, so "remove" can clear all of them. */
    const keysForValue = (
      assertions: EntityAssertionSummary[],
      value: string,
      keyOf: (assertion: EntityAssertionSummary) => string = (assertion) => assertion.value,
    ): string[] =>
      assertions
        .filter((assertion) => assertion.status === 'active' && keyOf(assertion) === value)
        .map((assertion) => assertion.key);

    const dateMarker = (element: string): string =>
      element === 'birth'
        ? t('LWC.desktop.sidebar.database.date_marker_birth')
        : t('LWC.desktop.sidebar.database.date_marker_death');

    const factTrailingClusterSx = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 0.25,
      width: '100%',
      minWidth: 0,
    };

    /** One row per distinct (element, value) — every source agreeing on "d. 226" shares one line. */
    const acceptDateGroupRow = (group: AssertionValueGroup): GridRow => {
      const year = Number(group.value);
      const display = Number.isFinite(year) ? scholarlyYear(year, group.precision, t) : group.value;
      return {
        key: group.keys.join('+'),
        label: '',
        value: `${dateMarker(group.element)} ${display}`,
        trailing: (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={factTrailingClusterSx}>
            <SourceBadges label={group.sources.join('+')} />
            <Box>
              <Tooltip title={t('LWC.desktop.sidebar.database.accept_data')}>
                <IconButton
                  size="small"
                  sx={neutralActionButtonSx}
                  onClick={() => queueValidation([group.keys[0]!], 'date')}
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Box>
              <Tooltip title={t('LWC.desktop.sidebar.database.reject_data')}>
                <IconButton
                  size="small"
                  sx={neutralActionButtonSx}
                  onClick={() =>
                    void runEntityMutationForId(
                      editEntity!.id,
                      t('LWC.desktop.sidebar.database.rejecting_data'),
                      (doc, id) => {
                        for (const key of group.keys) rejectEntityAssertion(doc, id, key);
                      },
                    )
                  }
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Stack>
        ),
      };
    };

    const dateBadgeLabel = [
      databaseView === 'central' ? 'CEDB' : 'PEDB',
      ...agreeingDateSources,
    ].join('+');

    const dateGridRows: GridRow[] =
      (editEntity?.kind === 'person' || editEntity?.kind === 'work') && !dateEditing
        ? [
            {
              key: 'dates-span',
              label: `${t('LWC.desktop.sidebar.database.dates')}:`,
              value:
                editEntity?.kind === 'work'
                  ? scholarlyDateRange(
                      workDate?.startYear ?? null,
                      workDate?.endYear ?? null,
                      workDate?.startPrecision,
                      workDate?.endPrecision,
                      t,
                    )
                  : scholarlyDateRange(
                      userBirthYear,
                      userDeathYear,
                      userBirthAssertion?.precision,
                      userDeathAssertion?.precision,
                      t,
                    ),
              trailing: (
                <Stack direction="row" spacing={0.5} alignItems="center" sx={factTrailingClusterSx}>
                  <SourceBadges label={dateBadgeLabel} />
                </Stack>
              ),
            },
            ...groupAssertionsByValue(pendingDateAssertions).map((group) =>
              acceptDateGroupRow(group),
            ),
          ]
        : [];

    /** Turns one multi-valued field (nationality, place of origin) into tab-aligned rows. */
    const buildValueFieldRows = (field: {
      label: string;
      values: string[];
      assertions: EntityAssertionSummary[];
      groups: FieldAssertionGroups;
      /** Canonical grouping/display key for an assertion (e.g. dynasty-id crosswalk); keyed on raw value by default. */
      keyOf?: (assertion: EntityAssertionSummary) => string;
    }): GridRow[] => {
      const keyOf = field.keyOf ?? ((assertion: EntityAssertionSummary) => assertion.value);
      const lines: (Omit<GridRow, 'key' | 'label'> & { key: string })[] = [];
      for (const value of field.values) {
        const sources = sourcesForValue(field.assertions, value, keyOf);
        const keys = keysForValue(field.assertions, value, keyOf);
        const authorityKeys = field.assertions
          .filter(
            (assertion) =>
              assertion.origin === 'authority' &&
              assertion.status === 'active' &&
              keyOf(assertion) === value,
          )
          .map((assertion) => assertion.key);
        const hasUserAssertion = field.assertions.some(
          (assertion) =>
            assertion.origin === 'user' &&
            assertion.status === 'active' &&
            keyOf(assertion) === value,
        );
        lines.push({
          key: `${field.label}:${value}`,
          value,
          trailing: (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={factTrailingClusterSx}>
              {hasUserAssertion && (
                <SourceBadges label={databaseView === 'central' ? 'CEDB' : 'PEDB'} />
              )}
              {sources.length > 0 && <SourceBadges label={sources.join('+')} />}
              {authorityKeys.length > 0 && !hasUserAssertion && (
                <Tooltip
                  title={`${t('LWC.desktop.sidebar.database.validate_data')}: ${field.label}`}
                >
                  <IconButton
                    size="small"
                    sx={neutralActionButtonSx}
                    aria-label={`${t('LWC.desktop.sidebar.database.validate_data')}: ${field.label} ${value}`}
                    onClick={() => queueValidation(authorityKeys)}
                  >
                    <CheckIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {keys.length > 0 && (
                <Tooltip title={t('LWC.desktop.sidebar.database.remove_value')}>
                  <IconButton
                    size="small"
                    sx={neutralActionButtonSx}
                    onClick={() =>
                      void runEntityMutationForId(
                        editEntity!.id,
                        t('LWC.desktop.sidebar.database.removing_data'),
                        (doc, id) => {
                          for (const key of keys) removeEntityValue(doc, id, key);
                        },
                      )
                    }
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          ),
        });
      }
      for (const group of groupAssertionsByValue(field.groups.pending, keyOf)) {
        lines.push({
          key: group.keys.join('+'),
          value: group.value,
          trailing: (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={factTrailingClusterSx}>
              <SourceBadges label={group.sources.join('+')} />
              <Tooltip title={t('LWC.desktop.sidebar.database.validate_data')}>
                <IconButton
                  size="small"
                  sx={neutralActionButtonSx}
                  onClick={() => queueValidation(group.keys)}
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('LWC.desktop.sidebar.database.reject_data')}>
                <IconButton
                  size="small"
                  sx={neutralActionButtonSx}
                  onClick={() =>
                    void runEntityMutationForId(
                      editEntity!.id,
                      t('LWC.desktop.sidebar.database.rejecting_data'),
                      (doc, id) => {
                        for (const key of group.keys) rejectEntityAssertion(doc, id, key);
                      },
                    )
                  }
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ),
        });
      }
      if (lines.length === 0) lines.push({ key: `${field.label}:empty`, value: '—' });
      return lines.map((line, index) => ({
        ...line,
        label: index === 0 ? `${field.label}:` : '',
      }));
    };

    const nationalityGridRows: GridRow[] =
      editEntity?.kind === 'person'
        ? buildValueFieldRows({
            label: t('LWC.desktop.sidebar.database.nationality'),
            values: editEntity.nationalities,
            assertions: nationalityAssertions,
            groups: nationalityGroups,
            keyOf: nationalityKeyOf,
          })
        : [];
    const originGridRows: GridRow[] =
      editEntity?.kind === 'person'
        ? buildValueFieldRows({
            label: t('LWC.desktop.sidebar.database.place_of_origin'),
            values: editEntity.placesOfOrigin,
            assertions: originAssertions,
            groups: originGroups,
          })
        : [];

    const descriptionAssertions =
      editEntity?.assertions.filter(
        (assertion) => assertion.element === 'note' && assertion.noteType === 'description',
      ) ?? [];
    const descriptionGroups = groupFieldAssertions(
      descriptionAssertions,
      new Set(editEntity?.description ? [editEntity.description] : []),
      false,
    );

    /** One row per distinct name text: authority badges + accept/reject, grouped like the fields above. */
    const nameTag = editEntity ? ENTITY_KINDS[editEntity.kind].name : null;
    const nameAssertions =
      nameTag && editEntity
        ? editEntity.assertions.filter(
            (assertion) => assertion.element === nameTag && assertion.status === 'active',
          )
        : [];
    const nameRows: NameRow[] = (editEntity?.nameEntries ?? [])
      .filter((entry) => entry.text !== editEntity?.romanized)
      .map((entry) => {
        const matching = nameAssertions.filter(
          (assertion) => assertion.value === entry.text && assertion.status === 'active',
        );
        const authorityMatching = matching.filter((assertion) => assertion.origin === 'authority');
        const sourcedMatching = matching.filter(
          (assertion) => assertion.status === 'active' && assertion.source,
        );
        return {
          key: entry.text,
          text: entry.text,
          sources: Array.from(
            new Set(
              sourcedMatching
                .map((assertion) => assertion.source?.split(':')[0])
                .filter((source): source is string => Boolean(source)),
            ),
          ),
          keys: authorityMatching.map((assertion) => assertion.key),
          isValidated: matching.some(
            (assertion) => assertion.origin === 'user' && Boolean(assertion.source),
          ),
          isPrimary: entry.text === editEntity?.names[0],
        };
      });

    /** One row per distinct role text: authority badges + accept/reject, like names. */
    interface RoleRow {
      key: string;
      text: string;
      sources: string[];
      keys: string[];
    }
    const roleAssertions =
      editEntity?.assertions.filter(
        (assertion) => assertion.element === 'affiliation' && assertion.status === 'active',
      ) ?? [];
    const roleRows: RoleRow[] = (editEntity?.roles ?? []).map((text) => {
      const matching = roleAssertions.filter((assertion) => assertion.value === text);
      const authorityMatching = matching.filter((assertion) => assertion.origin === 'authority');
      return {
        key: text,
        text,
        sources: Array.from(
          new Set(
            matching
              .filter((assertion) => assertion.source)
              .map((assertion) => assertion.source?.split(':')[0])
              .filter((source): source is string => Boolean(source)),
          ),
        ),
        keys: authorityMatching.map((assertion) => assertion.key),
      };
    });

    return {
      dateGridRows,
      nationalityGridRows,
      originGridRows,
      descriptionGroups,
      nameRows,
      roleRows,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editEntity, dateEditing, databaseView, runEntityMutationForId, t]);

  /** Name-type dropdown: commits immediately so curation doesn't require Save. */
  const commitNameType = (text: string, type: string) => {
    if (!editEntity) return;
    const id = editEntity.id;
    setEditNameTypes((previous) => ({ ...previous, [text]: type }));
    void runEntityMutation('Updating name type…', (doc) => {
      setNameType(doc, id, text, (type || null) as NameTypeId | null);
    });
  };

  const commitNameLanguage = (text: string, lang: string) => {
    if (!editEntity) return;
    const id = editEntity.id;
    setEditNameLanguages((previous) => ({ ...previous, [text]: lang }));
    void runEntityMutation('Updating name language…', (doc) => {
      setNameType(doc, id, text, (editNameTypes[text] || null) as NameTypeId | null, lang || null);
    });
  };

  /** Add-name row: text + type commit together as one new name element. */
  const commitNewName = () => {
    if (!editEntity) return;
    const id = editEntity.id;
    const text = editNewName.trim();
    if (!text) return;
    const type = (editNewNameType || null) as NameTypeId | null;
    if (type === 'translation' && !editNewNameLanguage) return;
    setEditNewName('');
    setEditNewNameType('');
    setEditNewNameLanguage('');
    void runEntityMutation('Adding name…', (doc) => {
      addEntityName(
        doc,
        id,
        text,
        type
          ? {
              type,
              ...(type === 'translation' && editNewNameLanguage
                ? { lang: editNewNameLanguage }
                : {}),
            }
          : undefined,
      );
    });
  };

  /** Delete button on a name row: removes it immediately. */
  const commitDeleteName = (text: string) => {
    if (!editEntity) return;
    const id = editEntity.id;
    void runEntityMutation('Removing name…', (doc) => {
      removeEntityName(doc, id, text);
    });
  };

  const commitNewNobleTitle = () => {
    if (!editEntity || editEntity.kind !== 'person') return;
    const input = newTitle;
    if (!Object.values(input).some((value) => value.trim())) return;
    setNewTitle({ dynasty: '', fief: '', posthumousName: '', title: '' });
    void runEntityMutation('Adding noble title…', (doc) =>
      addUserNobleTitle(doc, editEntity.id, input),
    );
  };

  const commitEditNobleTitle = (
    key: string,
    input: { dynasty: string; fief: string; posthumousName: string; title: string },
  ) => {
    if (!editEntity) return;
    void runEntityMutation('Updating noble title…', (doc) =>
      updateNobleTitle(doc, editEntity.id, key, input),
    );
  };

  const commitAddNationality = useCallback(
    (input: EntityLookupValue) => {
      if (!editEntity) return;
      void runEntityMutationForId(
        editEntity.id,
        t('LWC.desktop.sidebar.database.adding_data'),
        (doc, id) =>
          addUserNationality(doc, id, input.name, {
            ref: input.ref,
            source: authoritySourceFromLookupRef(input.ref),
          }),
      );
    },
    [editEntity, runEntityMutationForId, t],
  );

  const commitAddOrigin = useCallback(
    (input: EntityLookupValue) => {
      if (!editEntity) return;
      void runEntityMutationForId(
        editEntity.id,
        t('LWC.desktop.sidebar.database.adding_data'),
        (doc, id) =>
          addUserOrigin(doc, id, input.name, {
            ref: input.ref,
            source: authoritySourceFromLookupRef(input.ref),
          }),
      );
    },
    [editEntity, runEntityMutationForId, t],
  );

  const removeEditedValues = useCallback(
    (element: 'nationality' | 'placeName', values: { name: string }[]) => {
      if (!editEntity) return;
      const current =
        element === 'nationality' ? editEntity.nationalities : editEntity.placesOfOrigin;
      const removed = current.filter((value) => !values.some((item) => item.name === value));
      if (removed.length === 0) return;
      const keys = editEntity.assertions
        .filter(
          (assertion) =>
            assertion.element === element &&
            assertion.status === 'active' &&
            removed.includes(
              element === 'nationality'
                ? canonicalNationalityLabel(assertion.source, assertion.ref, assertion.value)
                : assertion.value,
            ),
        )
        .map((assertion) => assertion.key);
      if (keys.length === 0) return;
      void runEntityMutationForId(
        editEntity.id,
        t('LWC.desktop.sidebar.database.removing_data'),
        (doc, id) => {
          for (const key of keys) removeEntityValue(doc, id, key);
        },
      );
    },
    [editEntity, runEntityMutationForId, t],
  );

  const mergeDuplicateGroup = (group: DuplicateGroup) => {
    setMergeIds(group.entityIds);
    setMergeKeepId(oldestId(group.entityIds));
  };

  const markGroupIntentional = (group: DuplicateGroup) => {
    // Duplicate-authority detection is PEDB-only (see reload), so this always targets the project store.
    void runMutation(store, 'Marking as intentional…', (doc) => {
      markDuplicateIntentional(doc, group.entityIds);
    });
  };

  const rejectConcordanceConflict = (conflict: ConcordanceImportResult['conflicts'][number]) => {
    void runMutation(store, 'Rejecting concordance…', (doc) => {
      rejectConcordance(doc, conflict.association, conflict.entityIds[0]);
    });
  };

  const entityById = (id: string) => entities.find((entity) => entity.id === id);

  /** Jump the list to one entity (search pins it, checkbox selects it). */
  const jumpToEntity = (id: string) => {
    setKindFilter('all');
    setSearch(`^${escapeRegExp(id)}$`);
    setSelected(new Set([id]));
  };

  const openXPathForEntity = (entity: EntitySummary) => {
    const tagType =
      entity.kind === 'person'
        ? 'persName'
        : entity.kind === 'place'
          ? 'placeName'
          : entity.kind === 'org'
            ? 'orgName'
            : entity.kind === 'work'
              ? 'title'
              : entity.kind;
    window.dispatchEvent(
      new CustomEvent(DESKTOP_XPATH_SEARCH_EVENT, {
        detail: { query: `TEI//${tagType}[@key="${entity.id}"]` },
      }),
    );
  };

  /** Show every implicated entity together, preselected so Merge is one click away. */
  const reviewWarningEntities = (warning: LookupWarning) => {
    setKindFilter('all');
    setSearch(`^(${warning.entityIds.map(escapeRegExp).join('|')})$`);
    setSelected(new Set(warning.entityIds));
  };

  const dismissWarning = (warning: LookupWarning) => {
    if (!store) return;
    void (async () => {
      try {
        await resolveWarning(store, warning);
        setWarnings((previous) =>
          previous.filter((candidate) => warningKey(candidate) !== warningKey(warning)),
        );
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : String(error));
      }
    })();
  };

  if (!store) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {t('LWC.desktop.sidebar.database.open_project_hint')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Toolbar: search / type+view / tools */}
      <Stack spacing={1} sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          fullWidth
          inputRef={searchInputRef}
          size="small"
          placeholder={t('LWC.desktop.sidebar.database.search_placeholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          error={!!regexError}
          helperText={
            regexError
              ? t('LWC.desktop.sidebar.database.invalid_regex', { detail: regexError })
              : undefined
          }
          InputProps={{
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setSearch('')}
                  aria-label={t('LWC.desktop.sidebar.database.clear_search')}
                >
                  ×
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
        />
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'nowrap' }}>
          <Autocomplete
            size="small"
            disableClearable
            autoHighlight
            openOnFocus
            options={kindFilterOptions}
            value={selectedKindOption}
            onChange={(_event, option) => setKindFilter(option.value)}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(a, b) => a.value === b.value}
            sx={{ flex: 1, minWidth: 140 }}
            renderInput={(params) => (
              <TextField
                {...params}
                aria-label={t('LWC.desktop.sidebar.database.entity_type_filter')}
              />
            )}
          />
          <Tooltip
            title={
              databaseView === 'central'
                ? 'Browsing your central database'
                : 'Browsing this project’s database'
            }
          >
            <span>
              <Button
                size="small"
                variant="contained"
                color={databaseView === 'central' ? 'error' : 'success'}
                onClick={() =>
                  setDatabaseView((prev) => (prev === 'central' ? 'project' : 'central'))
                }
                startIcon={<HubOutlinedIcon fontSize="small" />}
                sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                {databaseView === 'central' ? 'Central' : 'Project'}
              </Button>
            </span>
          </Tooltip>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'nowrap' }}>
          <Tooltip
            title={
              selected.size >= 2
                ? t('LWC.desktop.sidebar.database.merge_selected', { count: selected.size })
                : t('LWC.desktop.sidebar.database.merge_hint')
            }
          >
            <span>
              <Button
                size="small"
                startIcon={<MergeIcon />}
                variant={selected.size >= 2 ? 'contained' : 'outlined'}
                onClick={handleMergeClick}
                sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                {t('LWC.desktop.sidebar.database.merge')}
                {selected.size >= 2 ? ` (${selected.size})` : ''}
              </Button>
            </span>
          </Tooltip>
          <Box sx={{ flex: 1, minWidth: 0 }} />
          {!syncToCentral && (
            <Tooltip title="Bridge to central database">
              <IconButton
                size="small"
                onClick={() => setBridgeOpen(true)}
                aria-label="Bridge to central database"
                sx={{ flexShrink: 0 }}
              >
                <HubOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {centralStore && (
            <Tooltip
              title={
                docketCount > 0
                  ? `Merge docket: ${docketCount} central suggestion(s) pending review`
                  : 'Merge docket'
              }
            >
              <IconButton
                size="small"
                onClick={() => setDocketOpen(true)}
                aria-label="Merge docket"
                sx={{ flexShrink: 0 }}
              >
                <Badge badgeContent={docketCount} color="warning">
                  <FactCheckOutlinedIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
          <Tooltip
            title={
              'Backfill from authorities — adds missing typed names (字/名/…), dates, nationality, and place of origin ' +
              "from CBDB/DILA/Norbert packs and Wikidata, plus noble titles from Norbert's canonical person_nt data " +
              '(Norbert has no place-of-origin data). ' +
              'Best results need a rebuilt CBDB pack with bare forms in names[]; Wikidata-linked people get live enrichment.'
            }
          >
            <span>
              <IconButton
                size="small"
                disabled={!activeStore || backfillBusy}
                onClick={() => void runNameBackfill()}
                aria-label="Backfill names from authorities"
                sx={{ flexShrink: 0 }}
              >
                <PlaylistAddIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('LWC.desktop.sidebar.database.reload_entities')}>
            <IconButton
              size="small"
              onClick={() => void reload()}
              aria-label={t('LWC.desktop.sidebar.database.reload_entities')}
              sx={{ flexShrink: 0 }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        {backfillBusy && (
          <Stack spacing={0.5}>
            <LinearProgress
              variant={
                backfillProgress && backfillProgress.total > 0 ? 'determinate' : 'indeterminate'
              }
              value={
                backfillProgress && backfillProgress.total > 0
                  ? (backfillProgress.done / backfillProgress.total) * 100
                  : undefined
              }
            />
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ flex: 1, minWidth: 0 }}
              >
                {backfillProgress?.entityLabel
                  ? `Enriching ${backfillProgress.entityLabel}… (${backfillProgress.done}/${backfillProgress.total || '…'})`
                  : 'Backfilling names from authorities…'}
              </Typography>
              <Button
                size="small"
                onClick={() => backfillAbortRef.current?.abort()}
                sx={{ flexShrink: 0 }}
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        )}
      </Stack>

      {/* Duplicate-authority warning */}
      {duplicates.length > 0 && (
        <Alert severity="warning" icon={<WarningAmberIcon fontSize="small" />} sx={{ m: 1, py: 0 }}>
          <Typography variant="caption" component="div" sx={{ fontWeight: 600 }}>
            {duplicates.length === 1
              ? t('LWC.desktop.sidebar.database.duplicate_authority_one')
              : t('LWC.desktop.sidebar.database.duplicate_authority_many', {
                  count: duplicates.length,
                })}
          </Typography>
          {duplicates.slice(0, 5).map((group) => (
            <Stack
              key={`${group.type}-${group.value}`}
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{ mt: 0.5 }}
            >
              <Typography variant="caption" sx={{ flex: 1, minWidth: 0 }} noWrap>
                {group.type} {group.value}:{' '}
                {group.entityIds.map((id) => entityById(id)?.names[0] ?? id).join(', ')}
              </Typography>
              <Button size="small" onClick={() => mergeDuplicateGroup(group)}>
                {t('LWC.desktop.sidebar.database.merge')}
              </Button>
              <Button size="small" onClick={() => markGroupIntentional(group)}>
                {t('LWC.desktop.sidebar.database.intentional')}
              </Button>
            </Stack>
          ))}
        </Alert>
      )}

      {concordanceConflicts.length > 0 && (
        <Alert severity="info" sx={{ m: 1, py: 0 }}>
          <Typography variant="caption" component="div" sx={{ fontWeight: 600 }}>
            CBDB concordance associations need review
          </Typography>
          {concordanceConflicts.slice(0, 5).map((conflict) => (
            <Stack
              key={`${conflict.association.source}:${conflict.association.canonicalId}:${conflict.association.mergedFromId}`}
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{ mt: 0.5 }}
            >
              <Typography variant="caption" sx={{ flex: 1, minWidth: 0 }} noWrap>
                {conflict.association.source} {conflict.association.canonicalId} ↔{' '}
                {conflict.association.mergedFromId}:{' '}
                {conflict.entityIds.map((id) => entityById(id)?.names[0] ?? id).join(', ')}
              </Typography>
              <Button size="small" onClick={() => rejectConcordanceConflict(conflict)}>
                Reject
              </Button>
            </Stack>
          ))}
        </Alert>
      )}

      {/* Lookup curation warnings (filed by the entity lookup dialog) */}
      {warnings.length > 0 && (
        <Alert severity="warning" icon={<WarningAmberIcon fontSize="small" />} sx={{ m: 1, py: 0 }}>
          <Typography variant="caption" component="div" sx={{ fontWeight: 600 }}>
            {warnings.length === 1
              ? t('LWC.desktop.sidebar.database.lookup_warning_one')
              : t('LWC.desktop.sidebar.database.lookup_warning_many', { count: warnings.length })}
          </Typography>
          {warnings.map((warning) => (
            <Box key={warningKey(warning)} sx={{ mt: 0.5 }}>
              <Tooltip title={warning.detail ?? ''}>
                <Typography variant="caption" component="div">
                  {warning.kind === 'concordance-conflict'
                    ? t('LWC.desktop.sidebar.database.lookup_conflict_duplicates', {
                        authority: warning.authority,
                        value: warning.value,
                      })
                    : t('LWC.desktop.sidebar.database.lookup_conflict_mismatch', {
                        authority: warning.authority,
                        value: warning.value,
                      })}
                </Typography>
              </Tooltip>
              <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" alignItems="center">
                {warning.entityIds.map((id) => (
                  <Chip
                    key={id}
                    label={entityById(id)?.names[0] ?? id}
                    size="small"
                    variant="outlined"
                    onClick={() => jumpToEntity(id)}
                    sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }}
                  />
                ))}
                {warning.kind === 'concordance-conflict' && warning.entityIds.length > 1 && (
                  <Button size="small" onClick={() => reviewWarningEntities(warning)}>
                    {t('LWC.desktop.sidebar.database.review')}
                  </Button>
                )}
                <Button size="small" onClick={() => dismissWarning(warning)}>
                  {t('LWC.desktop.sidebar.database.dismiss')}
                </Button>
              </Stack>
            </Box>
          ))}
        </Alert>
      )}

      {loadError && (
        <Alert severity="error" sx={{ m: 1 }} onClose={() => setLoadError(null)}>
          {loadError}
        </Alert>
      )}

      {/* Entity list */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={20} />
          </Box>
        ) : visible.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {entities.length === 0
              ? t('LWC.desktop.sidebar.database.empty')
              : t('LWC.desktop.sidebar.database.no_matches')}
          </Typography>
        ) : (
          visible.map((entity) => {
            const romanized = romanizedOf(entity);
            const authorities = sortAuthoritiesByPreference(
              normalizedAuthorityRefs(entity.authorities),
              authorityOrder,
              entity.kind,
            );
            return (
              <Box
                key={entity.id}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 0.5,
                  px: 1,
                  py: 0.75,
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: selected.has(entity.id) ? 'action.selected' : undefined,
                }}
              >
                <Checkbox
                  size="small"
                  checked={selected.has(entity.id)}
                  onChange={() => toggleSelected(entity.id)}
                  sx={{ p: 0.25, mt: 0.125 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} alignItems="baseline">
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {entity.names[0] ?? '(unnamed)'}
                    </Typography>
                    {romanized && romanized !== entity.names[0] && (
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {romanized}
                      </Typography>
                    )}
                    {authorities.length > 0 && (
                      <Box
                        component="span"
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          minWidth: 0,
                          flex: 1,
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {authorityBadgeGroups(authorities).map(({ ref, count }) => {
                          const url = authorityLookupUrl(ref);
                          return (
                            <Box
                              key={`${ref.type}-${ref.value}`}
                              component="span"
                              onClick={url ? () => openExternalUrl(url) : undefined}
                              sx={{
                                cursor: url ? 'pointer' : 'default',
                                display: 'inline-flex',
                                flexShrink: 0,
                              }}
                              title={ref.value}
                            >
                              <SourceBadges label={Array(count).fill(ref.type).join('+')} />
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography variant="caption" color="text.secondary" component="div" noWrap>
                      {entity.id}
                    </Typography>
                    <Tooltip title={t('LWC.desktop.sidebar.database.copy_id')}>
                      <IconButton
                        size="small"
                        aria-label={t('LWC.desktop.sidebar.database.copy_id')}
                        onClick={() =>
                          void navigator.clipboard.writeText(entity.id).then(() => {
                            notifyViaSnackbar({
                              message: t('LWC.desktop.sidebar.database.id_copied'),
                              options: { variant: 'success' },
                            });
                          })
                        }
                        sx={{ p: 0.25, flexShrink: 0 }}
                      >
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  {entity.description && (
                    <Typography variant="caption" color="text.secondary" component="div" noWrap>
                      {entity.description}
                    </Typography>
                  )}
                  {(entity.startYear != null ||
                    entity.endYear != null ||
                    entity.nationalities.length > 0 ||
                    entity.placesOfOrigin.length > 0) && (
                    <Typography variant="caption" color="text.secondary" component="div" noWrap>
                      {entity.startYear != null || entity.endYear != null
                        ? `${t('LWC.desktop.sidebar.database.dates')}: ${
                            entity.kind === 'work' && entity.workDate
                              ? scholarlyDateRange(
                                  entity.startYear,
                                  entity.endYear,
                                  entity.workDate.startPrecision,
                                  entity.workDate.endPrecision,
                                  t,
                                )
                              : `${entity.startYear ?? '—'}–${entity.endYear ?? '—'}`
                          }`
                        : ''}
                      {entity.nationalities.length > 0
                        ? `${entity.startYear != null || entity.endYear != null ? ' · ' : ''}${t('LWC.desktop.sidebar.database.dynasties')}: ${entity.nationalities.join(', ')}`
                        : ''}
                      {entity.placesOfOrigin.length > 0
                        ? `${entity.startYear != null || entity.endYear != null || entity.nationalities.length > 0 ? ' · ' : ''}${t('LWC.desktop.sidebar.database.origins')}: ${entity.placesOfOrigin.join(', ')}`
                        : ''}
                    </Typography>
                  )}
                </Box>
                <Tooltip title={t('LWC.desktop.sidebar.database.open')}>
                  <IconButton
                    size="small"
                    onClick={() => openEdit(entity)}
                    aria-label={t('LWC.desktop.sidebar.database.open')}
                    sx={{ flexShrink: 0 }}
                  >
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Find in XPath panel">
                  <IconButton
                    size="small"
                    onClick={() => openXPathForEntity(entity)}
                    aria-label="Find entity in XPath panel"
                    sx={{ flexShrink: 0 }}
                  >
                    <SearchIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            );
          })
        )}
      </Box>

      {/* Footer: counts */}
      <Box sx={{ px: 1.5, py: 0.5, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          {visible.length === entities.length
            ? `${entities.length} entities`
            : `${visible.length} of ${entities.length} entities`}
          {selected.size > 0 ? ` · ${selected.size} selected` : ''}
        </Typography>
      </Box>

      {/* Generic confirm dialog (delete / detach) */}
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{confirm?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirm?.body}</DialogContentText>
          {confirm?.showSkipDetachOption && (
            <FormControlLabel
              sx={{ mt: 1 }}
              control={
                <Checkbox
                  size="small"
                  checked={skipDetachChecked}
                  onChange={(event) => setSkipDetachChecked(event.target.checked)}
                />
              }
              label={t('LWC.desktop.sidebar.database.dont_warn_detach')}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>
            {t('LWC.desktop.sidebar.database.dialogs.cancel')}
          </Button>
          <Button
            color={confirm?.destructive ? 'error' : 'primary'}
            variant="contained"
            onClick={() => {
              if (confirm?.showSkipDetachOption && skipDetachChecked)
                setSkipEntityDetachConfirm(true);
              confirm?.onConfirm();
              setConfirm(null);
            }}
          >
            {confirm?.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Merge dialog */}
      <Dialog open={!!mergeIds} onClose={() => setMergeIds(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {t('LWC.desktop.sidebar.database.merge_dialog_title', { count: mergeIds?.length ?? 0 })}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            {t('LWC.desktop.sidebar.database.merge_dialog_message')}
          </DialogContentText>
          {mergeIds?.map((id) => {
            const entity = entityById(id);
            return (
              <Stack key={id} direction="row" alignItems="center" spacing={1}>
                <Radio
                  size="small"
                  checked={mergeKeepId === id}
                  onChange={() => setMergeKeepId(id)}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    {entity?.names.join(' · ') ?? id}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {id}
                    {entity?.description ? ` — ${entity.description}` : ''}
                  </Typography>
                </Box>
              </Stack>
            );
          })}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {t('LWC.desktop.sidebar.database.merge_dialog_note')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMergeIds(null)}>
            {t('LWC.desktop.sidebar.database.dialogs.cancel')}
          </Button>
          <Button variant="contained" onClick={confirmMerge}>
            {t('LWC.desktop.sidebar.database.merge')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editEntity} onClose={() => setEditEntity(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {editingName ? (
              <TextField
                autoFocus
                fullWidth
                size="small"
                variant="standard"
                value={editCanonicalName}
                onChange={(event) => setEditCanonicalName(event.target.value)}
                onBlur={acceptRename}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    acceptRename();
                  } else if (event.key === 'Escape') {
                    // Keep the Escape from also closing the dialog.
                    event.stopPropagation();
                    cancelRename();
                  }
                }}
                inputProps={{ 'aria-label': t('LWC.desktop.sidebar.database.rename_name') }}
                InputProps={{ sx: { typography: 'h6' } }}
              />
            ) : (
              <>
                <Typography
                  variant="h6"
                  component="button"
                  type="button"
                  onClick={startRename}
                  aria-label={t('LWC.desktop.sidebar.database.rename_name')}
                  sx={{
                    minWidth: 0,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    border: 0,
                    p: 0,
                    background: 'transparent',
                    color: 'inherit',
                    font: 'inherit',
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: 'text',
                  }}
                >
                  {editCanonicalName || editEntity?.id}
                </Typography>
                {editingRomanized ? (
                  <TextField
                    autoFocus
                    size="small"
                    variant="standard"
                    value={editRomanized}
                    onChange={(event) => setEditRomanized(event.target.value)}
                    onBlur={acceptRomanizedEdit}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        acceptRomanizedEdit();
                      } else if (event.key === 'Escape') {
                        event.stopPropagation();
                        cancelRomanizedEdit();
                      }
                    }}
                    inputProps={{ 'aria-label': t('LWC.desktop.sidebar.database.romanized_name') }}
                    InputProps={{
                      sx: { typography: 'body2' },
                      endAdornment: canAutoRomanize(projectLang) ? (
                        <InputAdornment position="end">
                          <Tooltip title={t('LWC.desktop.sidebar.database.generate_romanization')}>
                            <IconButton
                              size="small"
                              aria-label={t('LWC.desktop.sidebar.database.generate_romanization')}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() =>
                                setEditRomanized(
                                  autoRomanize(
                                    editCanonicalName || editEntity?.names[0] || '',
                                    projectLang,
                                  ) ?? editRomanized,
                                )
                              }
                            >
                              <AutorenewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ) : undefined,
                    }}
                    sx={{ minWidth: 0, maxWidth: 140 }}
                  />
                ) : (
                  <Typography
                    variant="body2"
                    component="button"
                    type="button"
                    onClick={startRomanizedEdit}
                    aria-label={t('LWC.desktop.sidebar.database.romanized_name')}
                    noWrap
                    sx={{
                      minWidth: 0,
                      maxWidth: 140,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      border: 0,
                      p: 0,
                      background: 'transparent',
                      color: 'text.secondary',
                      textAlign: 'left',
                      cursor: 'text',
                    }}
                  >
                    {editRomanized || t('LWC.desktop.sidebar.database.romanized_name')}
                  </Typography>
                )}
                <Tooltip title={t('LWC.desktop.sidebar.database.lookup_entity')}>
                  <IconButton
                    size="small"
                    onClick={() => editEntity && openEntityLookup(editEntity)}
                    aria-label={t('LWC.desktop.sidebar.database.lookup_entity')}
                    sx={{ p: 0.25 }}
                  >
                    <SearchIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </>
            )}
            <Box sx={{ flex: 1 }} />
            {(editEntity?.kind === 'person' || editEntity?.kind === 'work') && (
              <Tooltip title={t('LWC.desktop.sidebar.database.refresh_authorities')}>
                <span>
                  <IconButton
                    size="small"
                    aria-label={t('LWC.desktop.sidebar.database.refresh_authorities')}
                    disabled={backfillBusy || editEntity.authorities.length === 0}
                    onClick={() =>
                      editEntity.kind === 'work'
                        ? void refreshWorkDetails(editEntity)
                        : void runNameBackfill([editEntity.id])
                    }
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" component="div">
            {editEntity?.id}
          </Typography>
          {editEntity && normalizedAuthorityRefs(editEntity.authorities).length > 0 && (
            <Box
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', mt: 0.5 }}
            >
              {sortAuthoritiesByPreference(
                normalizedAuthorityRefs(editEntity.authorities),
                authorityOrder,
                editEntity.kind,
              ).map((ref) => {
                const url = authorityLookupUrl(ref);
                return (
                  <Stack
                    key={`${ref.type}-${ref.value}`}
                    direction="row"
                    spacing={0.25}
                    alignItems="center"
                  >
                    <Box
                      component="span"
                      onClick={url ? () => openExternalUrl(url) : undefined}
                      sx={{ cursor: url ? 'pointer' : 'default', display: 'inline-flex' }}
                      title={ref.type}
                    >
                      <SourceBadges label={ref.type} />
                    </Box>
                    <Typography variant="caption" noWrap sx={{ maxWidth: 220 }}>
                      {ref.value}
                    </Typography>
                    <Tooltip title={t('LWC.desktop.sidebar.database.detach_authority')}>
                      <IconButton
                        size="small"
                        aria-label={`${t('LWC.desktop.sidebar.database.detach_authority')} ${ref.type}`}
                        onClick={() => requestDetach(editEntity, ref)}
                        sx={{ p: 0.25, color: 'text.secondary' }}
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                );
              })}
            </Box>
          )}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            label={t('LWC.desktop.sidebar.database.one_line_description')}
            value={editDescription}
            onChange={(event) => setEditDescription(event.target.value)}
            sx={{ mt: 1 }}
          />
          {editEntity &&
            descriptionGroups.pending.map((assertion) => (
              <Stack
                key={assertion.key}
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{ mt: 0.5 }}
              >
                <Typography
                  variant="body2"
                  sx={{ flex: 1, minWidth: 0 }}
                  noWrap
                  title={assertion.value}
                >
                  {assertion.value}
                </Typography>
                <SourceBadges label={assertion.source?.split(':')[0] ?? 'authority'} />
                <Tooltip title={t('LWC.desktop.sidebar.database.accept_data')}>
                  <IconButton
                    size="small"
                    sx={neutralActionButtonSx}
                    onClick={() => {
                      const value = assertion.value;
                      queueValidation([assertion.key], 'description');
                      setEditDescription(value);
                    }}
                  >
                    <CheckIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('LWC.desktop.sidebar.database.reject_data')}>
                  <IconButton
                    size="small"
                    sx={neutralActionButtonSx}
                    onClick={() =>
                      void runEntityMutationForId(
                        editEntity.id,
                        t('LWC.desktop.sidebar.database.rejecting_data'),
                        (doc, id) => rejectEntityAssertion(doc, id, assertion.key),
                      )
                    }
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
          {editEntity?.kind === 'work' && dateEditing && (
            <Stack spacing={0.75} sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {t('LWC.desktop.sidebar.database.dates')}:
              </Typography>
              <Stack spacing={0.75}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <TextField
                    select
                    size="small"
                    value={workDateStartPrecision}
                    onChange={(event) =>
                      setWorkDateStartPrecision(event.target.value as WorkDatePrecision)
                    }
                    sx={{ minWidth: 140 }}
                  >
                    {WORK_DATE_START_PRECISION_OPTIONS.map((option) => (
                      <MenuItem key={option || 'exact'} value={option}>
                        {option || '—'}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    label={t('LWC.desktop.sidebar.database.from')}
                    value={workDateStart}
                    onChange={(event) =>
                      setWorkDateStart(event.target.value.replace(/[^0-9]/g, ''))
                    }
                    sx={{ flex: 1 }}
                    inputProps={{ inputMode: 'numeric' }}
                  />
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <TextField
                    select
                    size="small"
                    value={workDateEndPrecision}
                    onChange={(event) =>
                      setWorkDateEndPrecision(event.target.value as WorkDatePrecision)
                    }
                    sx={{ minWidth: 140 }}
                  >
                    {WORK_DATE_END_PRECISION_OPTIONS.map((option) => (
                      <MenuItem key={option || 'exact'} value={option}>
                        {option || '—'}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    label={t('LWC.desktop.sidebar.database.to')}
                    value={workDateEnd}
                    onChange={(event) => setWorkDateEnd(event.target.value.replace(/[^0-9]/g, ''))}
                    sx={{ flex: 1 }}
                    inputProps={{ inputMode: 'numeric' }}
                  />
                </Stack>
              </Stack>
              <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Button size="small" onClick={() => setDateEditing(false)}>
                  {t('LWC.desktop.sidebar.database.dialogs.cancel')}
                </Button>
                <Button size="small" variant="contained" onClick={saveWorkDates}>
                  {t('LWC.desktop.sidebar.database.save')}
                </Button>
              </Stack>
            </Stack>
          )}
          {editEntity?.kind === 'work' && !dateEditing && (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'max-content minmax(0, 1fr) minmax(0, 1fr)',
                  columnGap: 1,
                  rowGap: 0.25,
                  alignItems: 'center',
                  mt: 2,
                }}
              >
                {dateGridRows.map((row) => (
                  <Fragment key={row.key}>
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: 'nowrap', fontWeight: row.label ? 600 : 400 }}
                    >
                      {row.label}
                    </Typography>
                    <Typography variant="body2" color="text.primary" component="span">
                      <Box
                        component="button"
                        type="button"
                        onClick={() => setDateEditing(true)}
                        aria-label={t('LWC.desktop.sidebar.database.edit_dates')}
                        sx={{
                          border: 0,
                          p: 0,
                          background: 'transparent',
                          color: 'inherit',
                          font: 'inherit',
                          textAlign: 'left',
                          cursor: 'text',
                        }}
                      >
                        {row.value}
                      </Box>
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
                      {row.trailing}
                    </Box>
                  </Fragment>
                ))}
              </Box>
              <Box sx={{ mt: 2 }}>
                {editEntity.authors
                  .filter((author) => author.origin === 'authority')
                  .map((author) => (
                    <Stack
                      key={author.key}
                      direction="row"
                      spacing={0.5}
                      alignItems="center"
                      sx={{ mb: 0.5 }}
                    >
                      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                        {author.name}
                      </Typography>
                      {author.source && <SourceBadges label={author.source.split(':')[0]} />}
                      <Tooltip title={t('LWC.desktop.sidebar.database.validate_data')}>
                        <IconButton
                          size="small"
                          sx={neutralActionButtonSx}
                          onClick={() => queueValidation([author.key])}
                        >
                          <CheckIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('LWC.desktop.sidebar.database.reject_data')}>
                        <IconButton
                          size="small"
                          sx={neutralActionButtonSx}
                          onClick={() =>
                            void runEntityMutationForId(
                              editEntity.id,
                              t('LWC.desktop.sidebar.database.rejecting_data'),
                              (doc, id) => rejectEntityAssertion(doc, id, author.key),
                            )
                          }
                        >
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ))}
                <EntityLookupField
                  kind="person"
                  tag="persName"
                  label={`${t('LWC.desktop.sidebar.database.authors')}:`}
                  mode="multi"
                  values={editEntity.authors
                    .filter((author) => author.origin === 'user')
                    .map((author) => ({
                      name: author.name,
                      ref: author.ref ?? undefined,
                    }))}
                  onChange={(authors) =>
                    void runEntityMutationForId(editEntity.id, 'Saving authors…', (doc, id) =>
                      setUserWorkAuthors(doc, id, authors),
                    )
                  }
                />
              </Box>
            </>
          )}
          {editEntity?.kind === 'person' && (
            <Stack spacing={0.75} sx={{ mt: 2 }}>
              {dateEditing && (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {t('LWC.desktop.sidebar.database.dates')}:
                  </Typography>
                </Stack>
              )}
              {dateEditing && (
                <Stack spacing={0.75}>
                  {[
                    {
                      label: t('LWC.desktop.sidebar.database.birth'),
                      value: dateBirth,
                      setValue: setDateBirth,
                      qualifier: dateBirthQualifier,
                      setQualifier: setDateBirthQualifier,
                      bce: dateBirthBce,
                      setBce: setDateBirthBce,
                      options: ['b.', 'b. ca.', 'active', 'active ca.', 'fl.'],
                    },
                    {
                      label: t('LWC.desktop.sidebar.database.death'),
                      value: dateDeath,
                      setValue: setDateDeath,
                      qualifier: dateDeathQualifier,
                      setQualifier: setDateDeathQualifier,
                      bce: dateDeathBce,
                      setBce: setDateDeathBce,
                      options: [
                        'd.',
                        'd. ca.',
                        ...(dateBirthQualifier === 'active' || dateBirthQualifier === 'active ca.'
                          ? ['active to', 'active to ca.']
                          : []),
                      ],
                    },
                  ].map((part) => (
                    <Stack
                      key={part.label}
                      direction="row"
                      spacing={0.5}
                      alignItems="center"
                      sx={{
                        opacity:
                          dateBirthQualifier === 'fl.' &&
                          part.label === t('LWC.desktop.sidebar.database.death')
                            ? 0.5
                            : 1,
                      }}
                    >
                      <TextField
                        select
                        size="small"
                        value={part.qualifier}
                        onChange={(event) => part.setQualifier(event.target.value as DatePrecision)}
                        disabled={
                          dateBirthQualifier === 'fl.' &&
                          part.label === t('LWC.desktop.sidebar.database.death')
                        }
                        sx={{ width: 92 }}
                        SelectProps={{ native: true }}
                      >
                        {part.options.map((option) => (
                          <option key={option} value={option}>
                            {option || '—'}
                          </option>
                        ))}
                      </TextField>
                      <TextField
                        size="small"
                        label={part.label}
                        value={part.value}
                        onChange={(event) =>
                          part.setValue(event.target.value.replace(/[^0-9]/g, ''))
                        }
                        disabled={
                          dateBirthQualifier === 'fl.' &&
                          part.label === t('LWC.desktop.sidebar.database.death')
                        }
                        sx={{ flex: 1 }}
                        inputProps={{ inputMode: 'numeric' }}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            disabled={
                              dateBirthQualifier === 'fl.' &&
                              part.label === t('LWC.desktop.sidebar.database.death')
                            }
                            checked={part.bce}
                            onChange={(event) => part.setBce(event.target.checked)}
                          />
                        }
                        label="BCE"
                        sx={{ mr: 0 }}
                      />
                    </Stack>
                  ))}
                  {dateBirth &&
                    dateDeath &&
                    Math.abs(
                      (dateDeathBce ? -Number(dateDeath) : Number(dateDeath)) -
                        (dateBirthBce ? -Number(dateBirth) : Number(dateBirth)),
                    ) > 150 && (
                      <Alert severity="warning" sx={{ py: 0 }}>
                        {t('LWC.desktop.sidebar.database.date_lifespan_warning')}
                      </Alert>
                    )}
                  <Stack direction="row" justifyContent="flex-end" spacing={1}>
                    <Button size="small" onClick={() => setDateEditing(false)}>
                      {t('LWC.desktop.sidebar.database.dialogs.cancel')}
                    </Button>
                    <Button size="small" variant="contained" onClick={saveDates}>
                      {t('LWC.desktop.sidebar.database.save')}
                    </Button>
                  </Stack>
                </Stack>
              )}
              {valuesEditing && (
                <Stack spacing={1}>
                  <EntityLookupField
                    kind="place"
                    label={t('LWC.desktop.sidebar.database.nationality')}
                    mode="multi"
                    onChange={(values) => removeEditedValues('nationality', values)}
                    onPersistedChange={commitAddNationality}
                    tag="placeName"
                    values={editEntity.nationalities.map((name) => ({ name }))}
                  />
                  <EntityLookupField
                    kind="place"
                    label={t('LWC.desktop.sidebar.database.place_of_origin')}
                    mode="multi"
                    onChange={(values) => removeEditedValues('placeName', values)}
                    onPersistedChange={commitAddOrigin}
                    tag="placeName"
                    values={editEntity.placesOfOrigin.map((name) => ({ name }))}
                  />
                  <Stack direction="row" justifyContent="flex-end">
                    <Button size="small" onClick={() => setValuesEditing(false)}>
                      {t('LWC.desktop.sidebar.database.dialogs.cancel')}
                    </Button>
                  </Stack>
                </Stack>
              )}
              {!dateEditing && !valuesEditing && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'max-content minmax(0, 1fr) minmax(0, 1fr)',
                    columnGap: 1,
                    rowGap: 0.25,
                    alignItems: 'center',
                  }}
                >
                  {[...dateGridRows, ...nationalityGridRows, ...originGridRows].map((row) => (
                    <Fragment key={row.key}>
                      <Typography
                        variant="body2"
                        sx={{ whiteSpace: 'nowrap', fontWeight: row.label ? 600 : 400 }}
                      >
                        {row.label}
                      </Typography>
                      <Typography variant="body2" color="text.primary" component="span">
                        {row.key === dateGridRows[0]?.key ||
                        row.key === nationalityGridRows[0]?.key ||
                        row.key === originGridRows[0]?.key ? (
                          <Box
                            component="button"
                            type="button"
                            onClick={() =>
                              row.key === dateGridRows[0]?.key
                                ? setDateEditing(true)
                                : setValuesEditing(true)
                            }
                            aria-label={
                              row.key === dateGridRows[0]?.key
                                ? t('LWC.desktop.sidebar.database.edit_dates')
                                : t('LWC.desktop.sidebar.database.edit_values')
                            }
                            sx={{
                              border: 0,
                              p: 0,
                              background: 'transparent',
                              color: 'inherit',
                              font: 'inherit',
                              textAlign: 'left',
                              cursor: 'text',
                            }}
                          >
                            {row.value}
                          </Box>
                        ) : (
                          row.value
                        )}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
                        {row.trailing}
                      </Box>
                    </Fragment>
                  ))}
                </Box>
              )}
            </Stack>
          )}
          {editEntity && (
            <EntityNamesAccordion
              expanded={namesExpanded}
              onExpandedChange={setNamesExpanded}
              rows={nameRows}
              allowedNameTypes={editEntity.kind === 'work' ? WORK_TITLE_TYPES : ALL_NAME_TYPES}
              projectLang={projectLang}
              validatedSourceLabel={databaseView === 'central' ? 'CEDB' : 'PEDB'}
              nameTypes={editNameTypes}
              nameLanguages={editNameLanguages}
              onNameTypeChange={commitNameType}
              onNameLanguageChange={commitNameLanguage}
              onValidate={queueValidation}
              onReject={(keys) =>
                void runEntityMutationForId(
                  editEntity.id,
                  t('LWC.desktop.sidebar.database.rejecting_data'),
                  (doc, id) => {
                    for (const key of keys) rejectEntityAssertion(doc, id, key);
                  },
                )
              }
              onDelete={commitDeleteName}
              newName={editNewName}
              onNewNameChange={setEditNewName}
              newNameType={editNewNameType}
              onNewNameTypeChange={setEditNewNameType}
              newNameLanguage={editNewNameLanguage}
              onNewNameLanguageChange={setEditNewNameLanguage}
              onAdd={commitNewName}
              title={
                editEntity.kind === 'work'
                  ? t('LWC.desktop.sidebar.database.titles_heading')
                  : t('LWC.desktop.sidebar.database.names_heading')
              }
              hint={
                editEntity.kind === 'work'
                  ? t('LWC.desktop.sidebar.database.titles_hint')
                  : t('LWC.desktop.sidebar.database.names_hint')
              }
              addPlaceholder={
                editEntity.kind === 'work'
                  ? t('LWC.desktop.sidebar.database.add_title_placeholder')
                  : t('LWC.desktop.sidebar.database.add_name_placeholder')
              }
            />
          )}
          {editEntity && editEntity.kind === 'person' && (
            <Accordion
              disableGutters
              elevation={0}
              expanded={titlesExpanded}
              onChange={(_event, expanded) => setTitlesExpanded(expanded)}
              sx={{
                mt: 2,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                '&:before': { display: 'none' },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon fontSize="small" />}
                sx={{ minHeight: 0, '& .MuiAccordionSummary-content': { my: 1 } }}
              >
                <Typography variant="subtitle2">
                  {t('LWC.desktop.sidebar.database.noble_titles_heading')}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    {t('LWC.desktop.sidebar.database.noble_titles_hint')}
                  </Typography>
                  {editEntity.nobleTitles.map((title) => {
                    const input = {
                      dynasty: title.dynasty,
                      fief: title.fief,
                      posthumousName: title.posthumousName,
                      title: title.title,
                    };
                    return (
                      <Stack key={title.key} spacing={0.5}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {(['dynasty', 'fief', 'posthumousName', 'title'] as const).map(
                            (field) => (
                              <TextField
                                key={field}
                                size="small"
                                label={t(
                                  `LWC.desktop.sidebar.database.noble_title_fields.${field}`,
                                )}
                                defaultValue={input[field]}
                                onBlur={(event) =>
                                  commitEditNobleTitle(title.key, {
                                    ...input,
                                    [field]: event.target.value,
                                  })
                                }
                                sx={{ flex: 1, minWidth: 0 }}
                              />
                            ),
                          )}
                          {title.source && <SourceBadges label={title.source.split(':')[0]} />}
                          {title.origin === 'authority' && (
                            <IconButton
                              size="small"
                              sx={neutralActionButtonSx}
                              onClick={() => queueValidation([title.key])}
                            >
                              <CheckIcon fontSize="small" />
                            </IconButton>
                          )}
                          <IconButton
                            size="small"
                            sx={neutralActionButtonSx}
                            onClick={() =>
                              void runEntityMutation('Removing noble title…', (doc) =>
                                removeNobleTitle(doc, editEntity.id, title.key),
                              )
                            }
                          >
                            <ClearIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>
                    );
                  })}
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {(['dynasty', 'fief', 'posthumousName', 'title'] as const).map((field) => (
                      <TextField
                        key={field}
                        size="small"
                        label={t(`LWC.desktop.sidebar.database.noble_title_fields.${field}`)}
                        value={newTitle[field]}
                        onChange={(event) =>
                          setNewTitle((previous) => ({ ...previous, [field]: event.target.value }))
                        }
                        sx={{ flex: 1, minWidth: 0 }}
                      />
                    ))}
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={!Object.values(newTitle).some((value) => value.trim())}
                      onClick={commitNewNobleTitle}
                    >
                      {t('LWC.desktop.sidebar.database.add_name')}
                    </Button>
                  </Stack>
                </Stack>
              </AccordionDetails>
            </Accordion>
          )}
          {editEntity && editEntity.kind === 'person' && (
            <Accordion
              disableGutters
              elevation={0}
              expanded={rolesExpanded}
              onChange={(_event, expanded) => setRolesExpanded(expanded)}
              sx={{
                mt: 2,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                '&:before': { display: 'none' },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon fontSize="small" />}
                sx={{ minHeight: 0, '& .MuiAccordionSummary-content': { my: 1 } }}
              >
                <Typography variant="subtitle2">
                  {t('LWC.desktop.sidebar.database.roles_heading')}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={0.75}>
                  <Typography variant="caption" color="text.secondary">
                    {t('LWC.desktop.sidebar.database.roles_hint')}
                  </Typography>
                  {roleRows.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      {t('LWC.desktop.sidebar.database.no_roles')}
                    </Typography>
                  )}
                  {roleRows.map((row) => (
                    <Stack key={row.key} direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {row.text}
                      </Typography>
                      {row.sources.length > 0 && <SourceBadges label={row.sources.join('+')} />}
                      {row.keys.length > 0 && (
                        <>
                          <Tooltip title={t('LWC.desktop.sidebar.database.validate_data')}>
                            <IconButton
                              size="small"
                              sx={neutralActionButtonSx}
                              onClick={() => queueValidation(row.keys)}
                            >
                              <CheckIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('LWC.desktop.sidebar.database.reject_data')}>
                            <IconButton
                              size="small"
                              sx={neutralActionButtonSx}
                              onClick={() =>
                                void runEntityMutationForId(
                                  editEntity.id,
                                  t('LWC.desktop.sidebar.database.rejecting_data'),
                                  (doc, id) => {
                                    for (const key of row.keys) rejectEntityAssertion(doc, id, key);
                                  },
                                )
                              }
                            >
                              <ClearIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Stack>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditEntity(null)}>
            {t('LWC.desktop.sidebar.database.dialogs.cancel')}
          </Button>
          <Button variant="contained" onClick={saveEdit}>
            {t('LWC.desktop.sidebar.database.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Post-remap summary */}
      <Dialog open={!!lastSummary} onClose={() => setLastSummary(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('LWC.desktop.sidebar.database.dialogs.keys_updated')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {lastSummary
              ? `${lastSummary.keysUpdated} tag${lastSummary.keysUpdated === 1 ? '' : 's'} updated in ` +
                `${lastSummary.filesChanged} file${lastSummary.filesChanged === 1 ? '' : 's'} across ` +
                `${lastSummary.projectRoots.length} project${lastSummary.projectRoots.length === 1 ? '' : 's'}.`
              : ''}
          </DialogContentText>
          {lastSummary && lastSummary.errors.length > 0 && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {lastSummary.errors.slice(0, 5).map((message) => (
                <Typography key={message} variant="caption" component="div">
                  {message}
                </Typography>
              ))}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLastSummary(null)}>
            {t('LWC.desktop.sidebar.database.dialogs.close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Busy overlay */}
      <Dialog open={!!busyMessage}>
        <DialogContent>
          <Stack direction="row" spacing={2} alignItems="center">
            <CircularProgress size={20} />
            <Typography variant="body2">{busyMessage}</Typography>
          </Stack>
        </DialogContent>
      </Dialog>

      <BridgeInboxDialog
        open={bridgeOpen}
        onClose={() => setBridgeOpen(false)}
        onChanged={() => void reload()}
      />

      <MergeDocketDialog
        open={docketOpen}
        onClose={() => setDocketOpen(false)}
        centralStore={centralStore}
        onChanged={() => void reload()}
      />
    </Box>
  );
};
