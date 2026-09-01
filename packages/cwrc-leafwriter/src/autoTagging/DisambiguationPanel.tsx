import CheckIcon from '@mui/icons-material/Check';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import RoomIcon from '@mui/icons-material/Room';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import UndoIcon from '@mui/icons-material/Undo';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  MenuItem,
  Select,
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { CbdbIcon, DilaIcon, InitialsIcon } from '../icons/custom/AuthoritySource';
import { WikipediaIcon } from '../icons/custom/Wikipedia';
import { openExternalUrl } from '../utilities/DOM';
import { cachedPackReader } from '../services/authority-pack-lookup';
import {
  buildDisambiguationCandidates,
  candidateLinks,
  candidatePassesYearFilter,
  extractWikidataId,
  isOwnDatabaseSource,
  mergeCandidates,
  mergeSelectedCandidates,
  type CandidateLink,
  type DisambiguationCandidate,
} from './disambiguationCandidates';
import type { DesktopEntityStoreGlobals } from './entityStore';
import { suggestPersonRomanization } from '../plugins/personNameDefaults';
import { autoRomanizeForKind, canAutoRomanize } from '../utilities/romanize';
import { AUTHORITY_YEAR_MAX, AUTHORITY_YEAR_MIN } from './authoritySettings';
import {
  dateFilterFromSettings,
  disambiguationCachingDisabledFromSettings,
  persistDisambiguationDateFilter,
  persistDisambiguationSettings,
  persistPlaceProximityKm,
  placeProximityKmFromSettings,
  readPersistedDisambiguationSettings,
  yearRangeFromSettings,
} from './disambiguationSettings';
import {
  dateFilterForLookup,
  normalizeDateRangeFilter,
  type DateFilterMode,
  type DateRangeFilter,
} from './packLoader';
import { clusterByGeoAccessor } from './geoCluster';
import { PlaceComparisonMap, type MapPin } from './mapView/PlaceComparisonMap';
import { resolveManualAuthorityLink } from './manualAuthorityLink';
import type { AuthorityCache } from './authorityCache';
import { fetchWikidataSummary, type WikidataSummary } from './wikidataDates';
import {
  DisambiguationController,
  handleDisambiguationKey,
  mentionGroupKey,
  pendingInstances,
  syncMentionGroupFromElements,
  tagTypesPresent,
} from './disambiguationController';
import { TAG_TO_KIND } from './entities';
import { AutoTaggingSession } from './integration';
import {
  aiApiSettingsFromDesktop,
  createLlmClientFromSettings,
  isAiSuggestReady,
} from './llmClientFromSettings';
import {
  rankDisambiguationCandidates,
  lookupCachedDisambiguationRank,
} from './llmDisambiguationRank';
import type { DisambiguationAiRankResult } from './disambiguationAiCache';
import { getConfidenceLabel, getValidationColor } from './llmValidationRank';
import { SourceBadges } from './SourceBadges';
import {
  createDefaultAiPromptProfilesState,
  getActiveAiPromptProfile,
  persistAiPromptProfiles,
  readAiPromptProfilesFromDesktop,
  type AiPromptProfilesState,
} from './aiPromptProfiles';
import { AiPromptEditorDialog } from '../dialogs/autoTagging/AiPromptEditorDialog';
import type { MentionGroup, MentionInstance } from './mentions';
import { useActions } from '../overmind';
import { isAiUiFeatureEnabled } from './aiUiFeatures';

const wrapperIdentityElement = (element: Element): Element | null =>
  Array.from(element.getElementsByTagName('persName')).find(
    (person) => !person.getAttribute('type'),
  ) ?? null;

const wrapperNeedsPersonResolution = (instance: MentionInstance): boolean =>
  instance.tag === 'name' && !wrapperIdentityElement(instance.element)?.getAttribute('key');

const wrapperHasKeyConflict = (instance: MentionInstance): boolean => {
  if (instance.tag !== 'name') return false;
  const person = wrapperIdentityElement(instance.element);
  const wrapperKey = instance.element.getAttribute('key')?.trim();
  const personKey = person?.getAttribute('key')?.trim();
  return !!wrapperKey && !!personKey && wrapperKey !== personKey;
};

/**
 * Small persistent "AI" square — not a normal checkbox, a rounded square
 * that stays filled/outlined per state so it reads at a glance even
 * collapsed among the other panel controls. `disabled` is used for the
 * "Always on" case: the model is always curating, so there's nothing to
 * toggle, but the square still shows its (permanently-on) state.
 */
const AiCurationToggle = ({
  on,
  disabled,
  onClick,
  title,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) => {
  const { mode, systemMode } = useColorScheme();
  const isDark = mode === 'dark' || (mode === 'system' && systemMode === 'dark');
  const accent = 'rgb(255, 114, 0)'; // theme secondary.main — app's icon highlight colour
  const colors = on
    ? isDark
      ? { bgcolor: '#fff', color: '#000', borderColor: '#fff' }
      : { bgcolor: accent, color: '#fff', borderColor: accent }
    : isDark
      ? { bgcolor: '#000', color: '#fff', borderColor: '#fff' }
      : { bgcolor: 'transparent', color: accent, borderColor: accent };

  return (
    <Tooltip title={title}>
      <span>
        <ButtonBase
          disabled={disabled}
          onClick={onClick}
          aria-pressed={on}
          aria-label={title}
          sx={{
            width: 26,
            height: 26,
            flexShrink: 0,
            borderRadius: 1,
            border: '1.5px solid',
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1,
            opacity: disabled ? 0.7 : 1,
            ...colors,
          }}
        >
          AI
        </ButtonBase>
      </span>
    </Tooltip>
  );
};

export interface DisambiguationPanelProps {
  session: AutoTaggingSession;
  groups: MentionGroup[];
  /** When true, ask the configured model to pre-check candidates after lookup. */
  aiCuration?: boolean;
}

const stopRowClick = (event: { stopPropagation: () => void }) => event.stopPropagation();

/** Cycled by cluster discovery order for the group-header comparison map's pins. */
const PLACE_CLUSTER_COLORS = ['#d32f2f', '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#00838f'];

const AuthorityLinkIcon = ({ link }: { link: CandidateLink }) => (
  <IconButton
    size="small"
    aria-label={link.title}
    onMouseDown={stopRowClick}
    onClick={(event) => {
      stopRowClick(event);
      openExternalUrl(link.url);
    }}
    sx={{ p: 0.125, flexShrink: 0 }}
  >
    {link.kind === 'wikidata' ? (
      <WikipediaIcon sx={{ fontSize: 15 }} />
    ) : link.kind === 'cbdb' ? (
      <CbdbIcon sx={{ fontSize: 15 }} />
    ) : link.kind === 'viaf' ? (
      <InitialsIcon top="VI" bottom="AF" sx={{ fontSize: 15 }} />
    ) : link.kind === 'dila' ? (
      <DilaIcon sx={{ fontSize: 15 }} />
    ) : (
      <OpenInNewIcon sx={{ fontSize: 13 }} />
    )}
  </IconButton>
);

/**
 * Provenance labels that are not already visible as a clickable authority
 * link or the green "local" chip. Without this filter, CBDB/VIAF/Wikidata
 * appear twice (AuthorityLinkIcon + SourceBadges).
 *
 * When the project syncs to the central database there is no Local vs Central
 * split — hide those provenance keys even if a cached row still carries them.
 */
function provenanceSourcesForBadges(
  candidate: DisambiguationCandidate,
  links: CandidateLink[],
  hideOwnDatabase = false,
): string[] {
  const linked = new Set(links.map((link) => link.kind));
  return candidate.sources.filter((source) => {
    const key = source.trim().toLowerCase();
    if (hideOwnDatabase && isOwnDatabaseSource(key)) return false;
    if (key === 'cbdb' && linked.has('cbdb')) return false;
    if (key === 'viaf' && linked.has('viaf')) return false;
    if ((key === 'wikidata' || key === 'wikipedia') && linked.has('wikidata')) return false;
    if (key === 'dila' && linked.has('dila')) return false;
    if (key === 'entity-file' && candidate.fromEntityFile) return false;
    return true;
  });
}

function projectSyncsToCentral(): boolean {
  try {
    return (window as unknown as DesktopEntityStoreGlobals).__ljbLspProject?.syncToCentral === true;
  } catch {
    return false;
  }
}

interface SectionHeaderRowProps {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}

const SectionHeaderRow = ({ title, count, open, onToggle }: SectionHeaderRowProps) => (
  <Box sx={{ borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
    <Button
      fullWidth
      size="small"
      onClick={onToggle}
      endIcon={
        <ExpandMoreIcon
          sx={{ transform: open ? 'rotate(180deg)' : undefined, transition: '0.2s' }}
        />
      }
      sx={{
        justifyContent: 'space-between',
        textTransform: 'none',
        px: 1,
        py: 0.5,
        borderRadius: 0,
      }}
    >
      {title} ({count})
    </Button>
  </Box>
);

interface GroupHeaderProps {
  group: MentionGroup;
  isCurrent: boolean;
  expanded: boolean;
  resolved?: boolean;
  onToggle: () => void;
  onSelect: () => void;
  /** ≥2 geo clusters already prefetched for this group — see mapPinsForGroup. */
  mapPins?: MapPin[] | null;
  onOpenMap?: () => void;
}

const GroupHeader = ({
  group,
  isCurrent,
  expanded,
  resolved = false,
  onToggle,
  onSelect,
  mapPins,
  onOpenMap,
}: GroupHeaderProps) => {
  const pendingCount = pendingInstances(group).length;
  const entityKey = group.instances.find((item) => item.hasKey)?.element.getAttribute('key') ?? '';
  const showMapIcon = (mapPins?.length ?? 0) >= 2;

  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
      <Button
        fullWidth
        size="small"
        data-testid={`disambiguation-group-${group.surface}`}
        data-current={isCurrent || undefined}
        onClick={() => {
          onSelect();
          onToggle();
        }}
        endIcon={
          <ExpandMoreIcon
            sx={{ transform: expanded ? 'rotate(180deg)' : undefined, transition: '0.2s' }}
          />
        }
        sx={{
          justifyContent: 'space-between',
          textTransform: 'none',
          px: 0.75,
          py: 0.5,
          borderRadius: 0,
          borderLeft: '3px solid',
          borderLeftColor: isCurrent ? 'primary.main' : 'transparent',
          bgcolor: isCurrent ? 'action.selected' : undefined,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {group.surface}
          </Typography>
          <Chip
            size="small"
            label={group.tag}
            sx={{ height: 18, fontSize: 10, '& .MuiChip-label': { fontWeight: 400 } }}
          />
          {resolved ? (
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label={entityKey || 'resolved'}
              sx={{ height: 18, fontSize: 10, maxWidth: 120 }}
            />
          ) : (
            <Typography variant="caption" color="text.secondary" noWrap>
              {pendingCount} left · {group.instances.length} total
            </Typography>
          )}
        </Box>
      </Button>
      {showMapIcon && (
        <Tooltip title="Compare this group's geographic clusters on a map">
          <IconButton
            size="small"
            aria-label={`Compare ${group.surface} on map`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenMap?.();
            }}
            sx={{ borderRadius: 0, px: 0.75 }}
          >
            <RoomIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

interface InstanceContextProps {
  instance: MentionInstance;
  isCurrent: boolean;
  onSelect: () => void;
}

const InstanceContext = ({ instance, isCurrent, onSelect }: InstanceContextProps) => (
  <Box
    onClick={onSelect}
    sx={{
      px: 0.75,
      py: 0.5,
      cursor: 'pointer',
      borderLeft: '3px solid',
      borderLeftColor: isCurrent ? 'secondary.main' : 'transparent',
      bgcolor: isCurrent ? 'action.hover' : undefined,
    }}
  >
    <Typography variant="caption" color="text.secondary" component="div">
      …{instance.anchor.contextBefore}
      <b>{instance.anchor.surface}</b>
      {instance.anchor.contextAfter}…
    </Typography>
    {instance.hasKey && (
      <Typography variant="caption" color="success.main">
        @key={instance.element.getAttribute('key')}
      </Typography>
    )}
  </Box>
);

/**
 * Candidate row caption for period disambiguation (e.g. period-specific office entities —
 * see docs/entity-display-translations-planning.md Phase 3).
 * Real floruit shows as `fl. A–B`; CBDB index / nationality filter anchors stay off the caption.
 */
const formatCandidatePeriod = (candidate: DisambiguationCandidate): string => {
  if (candidate.dateSource === 'index' || candidate.dateSource === 'nationality') {
    return candidate.dynasty ?? '';
  }
  if (candidate.dateSource === 'floruit') {
    if (candidate.startYear == null && candidate.endYear == null) {
      return candidate.dynasty ?? '';
    }
    const span =
      candidate.startYear != null &&
      candidate.endYear != null &&
      candidate.startYear !== candidate.endYear
        ? `fl. ${candidate.startYear}–${candidate.endYear}`
        : `fl. ${candidate.startYear ?? candidate.endYear}`;
    return candidate.dynasty ? `${span} (${candidate.dynasty})` : span;
  }
  const range =
    candidate.startYear != null || candidate.endYear != null
      ? `${candidate.startYear ?? '?'}–${candidate.endYear ?? '?'}`
      : null;
  if (range && candidate.dynasty) return `${range} (${candidate.dynasty})`;
  return range ?? candidate.dynasty ?? '';
};

type DisambiguationListRow =
  | { kind: 'pending-group'; group: MentionGroup }
  | { kind: 'empty'; message: string }
  | { kind: 'resolved-header' }
  | { kind: 'resolved-group'; group: MentionGroup };

export const DisambiguationPanel = ({
  session,
  groups,
  aiCuration = false,
}: DisambiguationPanelProps) => {
  const { t, i18n } = useTranslation('LW');
  const { setDisambiguationAiCuration } = useActions().ui;
  const disambiguationAiEnabled = isAiUiFeatureEnabled('disambiguationCurate');
  const aiAlwaysOn = aiApiSettingsFromDesktop()?.alwaysOn === true;
  const handleToggleAiCuration = () => {
    const next = !aiCuration;
    setDisambiguationAiCuration(next);
    void persistDisambiguationSettings({
      ...readPersistedDisambiguationSettings(),
      aiCuration: next,
    });
  };
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const groupListRef = useRef<VirtuosoHandle>(null);
  const [candidates, setCandidates] = useState<DisambiguationCandidate[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [rankingAi, setRankingAi] = useState(false);
  const [aiRanked, setAiRanked] = useState(false);
  const [aiRationales, setAiRationales] = useState<Record<string, string>>({});
  const [aiConfidences, setAiConfidences] = useState<Record<string, number>>({});
  const [rateLimitRetry, setRateLimitRetry] = useState<{
    attempt: number;
    maxAttempts: number;
    retryAtMs: number;
  } | null>(null);
  const [rateLimitSecondsLeft, setRateLimitSecondsLeft] = useState(0);
  const [aiSuggestCreateNew, setAiSuggestCreateNew] = useState(false);
  const [aiCreateRationale, setAiCreateRationale] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string>('');
  const [resolvedOpen, setResolvedOpen] = useState(false);
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>(() =>
    dateFilterFromSettings(
      readPersistedDisambiguationSettings(),
      window.__leafWriterProject?.getActiveFileWorkYear?.(),
    ),
  );
  const [yearRange, setYearRange] = useState<[number, number]>(() =>
    yearRangeFromSettings(
      readPersistedDisambiguationSettings(),
      window.__leafWriterProject?.getActiveFileWorkYear?.(),
    ),
  );
  const dateFilter: DateRangeFilter = useMemo(
    () =>
      normalizeDateRangeFilter({ mode: dateFilterMode, start: yearRange[0], end: yearRange[1] }),
    [dateFilterMode, yearRange],
  );
  /** Same filter the UI shows, widened for matching (see dateFilterForLookup). */
  const lookupDateFilter = useMemo(
    () => dateFilterForLookup(dateFilter) ?? dateFilter,
    [dateFilter],
  );
  const cycleDateFilterMode = () => {
    setDateFilterMode((mode) => {
      const next = mode === 'none' ? 'limit' : mode === 'limit' ? 'exclude' : 'none';
      void persistDisambiguationDateFilter(next, yearRange);
      return next;
    });
  };
  const commitYearRange = (range: [number, number]) => {
    setYearRange(range);
    void persistDisambiguationDateFilter(dateFilterMode, range);
  };
  const [placeProximityKm, setPlaceProximityKm] = useState<number>(() =>
    placeProximityKmFromSettings(readPersistedDisambiguationSettings()),
  );
  const commitPlaceProximityKm = (km: number) => {
    setPlaceProximityKm(km);
    void persistPlaceProximityKm(km);
  };
  const [aiPromptProfiles, setAiPromptProfiles] = useState<AiPromptProfilesState>(
    createDefaultAiPromptProfilesState(),
  );
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [manualLinkOpen, setManualLinkOpen] = useState(false);
  const [manualLinkValue, setManualLinkValue] = useState('');
  const [manualLinkBusy, setManualLinkBusy] = useState(false);
  const [manualLinkError, setManualLinkError] = useState<string | null>(null);
  const [newEntityDialogOpen, setNewEntityDialogOpen] = useState(false);
  const [newEntityDescription, setNewEntityDescription] = useState('');
  const [newEntityRomanized, setNewEntityRomanized] = useState('');
  const [newEntityBusy, setNewEntityBusy] = useState(false);
  const [projectLang, setProjectLang] = useState<string | null>(null);
  const [commonsUiRevision, setCommonsUiRevision] = useState(0);
  const cacheDisabled = disambiguationCachingDisabledFromSettings(
    readPersistedDisambiguationSettings(),
  );

  const activePromptProfile = useMemo(
    () => getActiveAiPromptProfile(aiPromptProfiles),
    [aiPromptProfiles],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const lang = (await window.__leafWriterProject?.getProjectSourceLanguage?.()) ?? null;
        if (!cancelled) setProjectLang(lang);
      } catch {
        // no bridge (web app) — dual-script enrichment simply stays off
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void readAiPromptProfilesFromDesktop().then(setAiPromptProfiles);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onCommonsUiChanged = () => setCommonsUiRevision((value) => value + 1);
    window.addEventListener('ljbCommonsUiChanged', onCommonsUiChanged);
    return () => window.removeEventListener('ljbCommonsUiChanged', onCommonsUiChanged);
  }, []);

  useEffect(() => {
    if (!rateLimitRetry) return;
    const tick = () => {
      setRateLimitSecondsLeft(
        Math.max(0, Math.ceil((rateLimitRetry.retryAtMs - Date.now()) / 1000)),
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [rateLimitRetry]);

  const focusMention = useCallback(
    (instance: MentionInstance) => {
      try {
        session.focusMention(instance);
      } catch {
        // best-effort
      }
    },
    [session],
  );

  const controllerRef = useRef<DisambiguationController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new DisambiguationController(
      groups,
      { tag: tagFilter || null },
      { onFocus: focusMention },
    );
  }

  const controller = controllerRef.current;

  useEffect(() => {
    controller.setGroups(groups);
  }, [controller, groups]);

  useEffect(() => {
    controller.setFilters({ tag: tagFilter || null });
    forceRender();
  }, [controller, tagFilter]);

  const group = controller.currentGroup();
  const instance = controller.currentInstance();
  const counts = controller.counts();
  const pending = controller.pendingGroups();
  const resolved = controller.resolvedGroups();
  const currentKey = group ? mentionGroupKey(group) : null;
  const currentKeyRef = useRef<string | null>(null);
  currentKeyRef.current = currentKey;
  const tagOptions = useMemo(() => tagTypesPresent(groups), [groups]);
  const keyedEntityIds = useMemo(
    () =>
      new Set(
        groups.flatMap((item) =>
          item.instances
            .map((instance) => instance.element.getAttribute('key')?.trim())
            .filter((key): key is string => !!key),
        ),
      ),
    [groups],
  );

  useEffect(() => {
    if (tagFilter && !tagOptions.includes(tagFilter)) setTagFilter('');
  }, [tagFilter, tagOptions]);

  const toggleCandidate = (candidateId: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(candidateId);
      else next.delete(candidateId);
      return next;
    });
  };

  const applyRankResult = useCallback((rank: DisambiguationAiRankResult, groupKey: string) => {
    if (currentKeyRef.current !== groupKey) return;
    setAiRationales(rank.rationales);
    setAiConfidences(rank.confidences ?? {});
    if (rank.selectedCandidateIds.length > 0) {
      setCheckedIds(new Set(rank.selectedCandidateIds));
      setAiSuggestCreateNew(false);
      setAiCreateRationale(null);
    } else if (rank.suggestCreateNew) {
      setCheckedIds(new Set());
      setAiSuggestCreateNew(true);
      setAiCreateRationale(rank.createNewRationale ?? null);
    } else {
      setCheckedIds(new Set());
      setAiSuggestCreateNew(false);
      setAiCreateRationale(null);
    }
    setAiRanked(true);
  }, []);

  const applyAiRank = useCallback(
    async (
      targetGroup: MentionGroup,
      rows: DisambiguationCandidate[],
      targetInstance: MentionInstance,
    ) => {
      // Guard against a stale call landing after the user has already moved on
      // to a different group (e.g. rapid j/k navigation) — otherwise its
      // resets and eventual results would clobber the now-current group's state.
      const groupKey = mentionGroupKey(targetGroup);
      if (currentKeyRef.current !== groupKey) return;

      setAiRationales({});
      setAiConfidences({});
      setAiSuggestCreateNew(false);
      setAiCreateRationale(null);
      setRateLimitRetry(null);
      setAiRanked(false);

      if (!aiCuration || rows.length === 0) return;

      const settings = aiApiSettingsFromDesktop();
      if (!settings || !isAiSuggestReady(settings)) return;

      const doc = await session.getDocument();
      const client = createLlmClientFromSettings(settings);
      const cachedRank = await lookupCachedDisambiguationRank({
        doc,
        instance: targetInstance,
        candidates: rows,
        client,
        cache: cacheDisabled ? null : session.disambiguationAiCache,
        promptProfile: activePromptProfile,
      });
      if (cachedRank) {
        applyRankResult(cachedRank, groupKey);
        return;
      }

      setRankingAi(true);
      try {
        const rank = await rankDisambiguationCandidates({
          doc,
          instance: targetInstance,
          candidates: rows,
          client,
          cache: cacheDisabled ? null : session.disambiguationAiCache,
          promptProfile: activePromptProfile,
          preferredLanguage: i18n.language,
          onRateLimitRetry: (info) =>
            setRateLimitRetry({
              attempt: info.attempt,
              maxAttempts: info.maxAttempts,
              retryAtMs: Date.now() + info.delayMs,
            }),
        });
        if (!rank || currentKeyRef.current !== groupKey) return;

        applyRankResult(rank, groupKey);
      } catch (e) {
        if (currentKeyRef.current !== groupKey) return;
        setError(e instanceof Error ? e.message : String(e));
        setAiRanked(true);
      } finally {
        if (currentKeyRef.current === groupKey) {
          setRankingAi(false);
          setRateLimitRetry(null);
        }
      }
    },
    [activePromptProfile, aiCuration, applyRankResult, cacheDisabled, i18n.language, session],
  );

  /**
   * DILA place dates are fetched lazily (there is no by-string search API — only
   * by id), so the first pass over a surface can come back with undated DILA
   * candidates while their detail scrapes complete in the background. Once every
   * queued fetch for a group lands in the cache, this re-runs the (now all-cached,
   * no-network) lookup and quietly swaps in the dated rows — but only if the panel
   * is still showing that same group; otherwise the update is dropped.
   */
  const refreshDilaDates = useCallback(
    async (
      targetGroup: MentionGroup,
      cache: AuthorityCache,
      dbSources: {
        local: DisambiguationCandidate[];
        central?: {
          userStableId: string;
          candidates: DisambiguationCandidate[];
        };
        entitiesDoc: Document | null;
      },
      retryWhenPending = false,
    ) => {
      const groupKey = mentionGroupKey(targetGroup);
      try {
        const rows = await buildDisambiguationCandidates(
          dbSources.entitiesDoc,
          targetGroup.tag,
          targetGroup.surface,
          cache,
          ['Wikidata', 'VIAF'],
          false,
          cachedPackReader(),
          session.dilaPlaceDetailCache ?? undefined,
          undefined,
          // When healing stale cached rows, the detail scrapes may still be in
          // flight; retry exactly once after they land (bounded, so permanently
          // failing scrapes can't loop).
          retryWhenPending
            ? () => {
                if (currentKeyRef.current !== groupKey) return;
                void refreshDilaDates(targetGroup, cache, dbSources, false);
              }
            : undefined,
          projectLang,
          dbSources.central,
          placeProximityKm,
          dbSources.local,
        );
        if (currentKeyRef.current !== groupKey) return;
        setCandidates(rows);
        if (!cacheDisabled) {
          session.rememberPendingCandidates(targetGroup.tag, targetGroup.surface, rows);
          await session.savePendingCache();
        }
      } catch {
        // Best-effort silent refresh; leave the existing (undated) candidates as-is.
      }
    },
    [cacheDisabled, placeProximityKm, projectLang, session],
  );

  const loadCandidates = useCallback(
    async (targetGroup: MentionGroup, forceRefresh = false) => {
      // Captured once so every later commit in this call can check it's still
      // the group the panel is showing — an in-flight fetch for a group the
      // user has since navigated away from must not overwrite the new group's
      // candidates (this is how a stale, unrelated, possibly-checked candidate
      // could otherwise appear under the wrong group after quick j/k navigation).
      const groupKey = mentionGroupKey(targetGroup);
      setError(null);
      setAiRationales({});
      setAiConfidences({});
      setAiSuggestCreateNew(false);
      setAiCreateRationale(null);
      setRateLimitRetry(null);
      setAiRanked(false);

      const pendingCache = cacheDisabled
        ? null
        : session.getPendingCandidates(targetGroup.tag, targetGroup.surface);

      if (pendingCache && !forceRefresh) {
        // Show the last authority lookup immediately; merge in fresh local DB hits next.
        if (currentKeyRef.current === groupKey) setCandidates(pendingCache);
      } else {
        setLoadingCandidates(true);
        setCandidates([]);
      }

      try {
        const cached = pendingCache;
        if (cached && !forceRefresh) {
          // The cache only exists to avoid re-querying external authorities;
          // the project's own entity database is cheap to re-read (SQLite name
          // search, or XML fallback), so always merge in fresh local matches.
          const dbSources = await session.disambiguationDbSources(
            targetGroup.tag,
            targetGroup.surface,
          );
          const rows = mergeCandidates(
            [dbSources.local, dbSources.central?.candidates ?? [], cached],
            {
              tag: targetGroup.tag,
              placeProximityKm,
            },
          );
          if (currentKeyRef.current !== groupKey) return;
          setCandidates(rows);
          // The prefetcher can cache DILA place rows before their lazy detail
          // scrapes (dynasty/dates) have landed. Heal such rows in the
          // background: rebuild from the now-warm caches and swap in the dated
          // candidates, kicking off (and retrying once after) any still-missing
          // scrapes.
          const needsDilaDates = rows.some(
            (row) =>
              row.sources.includes('DILA') &&
              targetGroup.tag === 'placeName' &&
              row.startYear == null &&
              row.endYear == null &&
              !row.dynasty,
          );
          if (needsDilaDates && session.cache) {
            const cacheForRefresh = session.cache;
            void (async () => {
              void refreshDilaDates(targetGroup, cacheForRefresh, dbSources, true);
            })();
          }
          return;
        }
        const cache = session.cache;
        if (!cache) throw new Error('Authority cache is unavailable.');
        const dbSources = await session.disambiguationDbSources(
          targetGroup.tag,
          targetGroup.surface,
        );
        const rows = await buildDisambiguationCandidates(
          dbSources.entitiesDoc,
          targetGroup.tag,
          targetGroup.surface,
          cache,
          ['Wikidata', 'VIAF'],
          forceRefresh,
          cachedPackReader(),
          session.dilaPlaceDetailCache ?? undefined,
          undefined,
          () => {
            if (currentKeyRef.current !== groupKey) return;
            void refreshDilaDates(targetGroup, cache, dbSources);
          },
          projectLang,
          dbSources.central,
          placeProximityKm,
          dbSources.local,
        );
        if (!cacheDisabled) {
          session.rememberPendingCandidates(targetGroup.tag, targetGroup.surface, rows);
          await session.savePendingCache();
        }
        if (currentKeyRef.current !== groupKey) return;
        setCandidates(rows);
      } catch (e) {
        if (currentKeyRef.current !== groupKey) return;
        setError(e instanceof Error ? e.message : String(e));
        setCandidates([]);
      } finally {
        if (currentKeyRef.current === groupKey) setLoadingCandidates(false);
      }
    },
    [cacheDisabled, placeProximityKm, projectLang, refreshDilaDates, session],
  );

  useEffect(() => {
    if (!group || !controller.isExpanded(group)) {
      setCandidates([]);
      return;
    }
    void loadCandidates(group, false);
    // The expansion check is deliberately inline: this must re-run when the group
    // is expanded or collapsed, which is not reachable from `group` alone. Naming
    // `controller` or `group` as the rule asks would re-run on every render,
    // since the controller object is rebuilt each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.surface, group?.tag, group && controller.isExpanded(group), instance, loadCandidates]);

  useEffect(() => {
    setManualLinkOpen(false);
    setManualLinkValue('');
    setManualLinkError(null);
  }, [group?.surface, group?.tag, instance]);

  const filteredCandidates = useMemo(
    () => candidates.filter((candidate) => candidatePassesYearFilter(candidate, lookupDateFilter)),
    [candidates, lookupDateFilter],
  );

  /**
   * Every geo-bearing candidate gets a letter — even when they all land in
   * one cluster (e.g. the same city across several eras), the letter still
   * marks "this one has coordinates" (see the per-candidate chip below).
   * Multiple letters only appear once candidates actually land in different
   * clusters, which is also what unlocks the group header's "compare on
   * map" icon (mapPinsForGroup, >= 2 clusters). Letters are assigned in
   * cluster-discovery order, stable for a given candidate list but not
   * meaningful beyond "these are the same group" — see geoCluster.ts.
   */
  const placeClusterLabelById = useMemo(() => {
    if (group?.tag !== 'placeName') return null;
    const { clusters } = clusterByGeoAccessor(
      filteredCandidates,
      placeProximityKm,
      (candidate) => candidate.geo,
    );
    if (clusters.length === 0) return null;
    const byId = new Map<string, string>();
    clusters.forEach((cluster, index) => {
      const label = String.fromCharCode(65 + index); // A, B, C, …
      for (const member of cluster.members) byId.set(member.id, label);
    });
    return byId;
  }, [group?.tag, filteredCandidates, placeProximityKm]);

  /**
   * Candidates with coordinates first (stable otherwise) — the geo-bearing
   * ones are the ones worth comparing/checking against a map, so they
   * shouldn't be buried below a long tail of no-geo candidates.
   */
  const displayCandidates = useMemo(() => {
    if (!placeClusterLabelById) return filteredCandidates;
    return [...filteredCandidates].sort(
      (a, b) => Number(!placeClusterLabelById.has(a.id)) - Number(!placeClusterLabelById.has(b.id)),
    );
  }, [filteredCandidates, placeClusterLabelById]);

  const [mapModal, setMapModal] = useState<{ title: string; pins: MapPin[] } | null>(null);

  /**
   * Pins for a group's header map icon, or null/empty when there's nothing
   * to compare. For the currently expanded group, uses the already-fetched
   * `filteredCandidates` (same data the A/B cluster-letter chips are built
   * from) rather than the background prefetcher's cache — when "Disable
   * caching" is on, `runAuthorityPrefetch` is a no-op and nothing ever
   * writes to that cache (see authorityPrefetch.ts), so a cache-only read
   * would leave the icon permanently missing even though this group's data
   * is sitting right there in state. Other (not-currently-expanded) groups
   * still rely on the prefetch cache — see
   * docs/placename-geo-disambiguation-planning.md Phase 6, WP3.
   */
  const mapPinsForGroup = useCallback(
    (targetGroup: MentionGroup): MapPin[] => {
      if (targetGroup.tag !== 'placeName') return [];
      const isCurrentGroup = group != null && mentionGroupKey(targetGroup) === currentKey;
      const source = isCurrentGroup
        ? filteredCandidates
        : session.getPendingCandidates(targetGroup.tag, targetGroup.surface);
      if (!source || source.length === 0) return [];
      const { clusters } = clusterByGeoAccessor(
        source,
        placeProximityKm,
        (candidate) => candidate.geo,
      );
      if (clusters.length === 0) return [];
      return clusters.map((cluster, index) => ({
        id: cluster.members[0]!.id,
        label: String.fromCharCode(65 + index),
        color: PLACE_CLUSTER_COLORS[index % PLACE_CLUSTER_COLORS.length]!,
        lat: cluster.centroid.lat,
        lon: cluster.centroid.lon,
        sources: [...new Set(cluster.members.flatMap((member) => member.sources))],
        description: [...new Set(cluster.members.map((member) => member.label))].join(' / '),
      }));
    },
    [placeProximityKm, session, group, currentKey, filteredCandidates],
  );

  useEffect(() => {
    if (!aiCuration || rankingAi || loadingCandidates || aiRanked) return;
    if (!group || !controller.isExpanded(group) || candidates.length === 0) return;
    if (Object.keys(aiRationales).length > 0 || aiSuggestCreateNew) return;
    const inst = instance ?? controllerRef.current?.currentInstance();
    if (!inst) return;
    void applyAiRank(group, filteredCandidates, inst);
  }, [
    aiCuration,
    aiRationales,
    aiSuggestCreateNew,
    applyAiRank,
    candidates.length,
    controller,
    filteredCandidates,
    group,
    instance,
    loadingCandidates,
    aiRanked,
    rankingAi,
    commonsUiRevision,
  ]);

  useEffect(() => {
    if (filteredCandidates.length === 1 && !aiCuration) {
      setCheckedIds(new Set([filteredCandidates[0]!.id]));
    } else if (
      filteredCandidates.length === 1 &&
      aiCuration &&
      Object.keys(aiRationales).length === 0 &&
      !aiSuggestCreateNew
    ) {
      setCheckedIds(new Set([filteredCandidates[0]!.id]));
    } else if (!aiCuration && filteredCandidates.length !== 1) {
      setCheckedIds(new Set());
    }
  }, [
    aiCuration,
    aiRationales,
    aiSuggestCreateNew,
    group?.surface,
    group?.tag,
    filteredCandidates,
  ]);

  useEffect(() => {
    if (pending.length === 0 && resolved.length > 0) setResolvedOpen(true);
  }, [pending.length, resolved.length]);

  const listRows = useMemo<DisambiguationListRow[]>(() => {
    const rows: DisambiguationListRow[] = pending.map((targetGroup) => ({
      kind: 'pending-group',
      group: targetGroup,
    }));

    if (pending.length === 0 && resolved.length === 0) {
      rows.push({
        kind: 'empty',
        message: t('LW.autoTagging.disambiguation.noMentionsInFilter'),
      });
      return rows;
    }

    if (pending.length === 0 && resolved.length > 0) {
      rows.push({
        kind: 'empty',
        message: t('LW.autoTagging.disambiguation.noPendingItems'),
      });
    }

    if (resolved.length > 0) {
      rows.push({ kind: 'resolved-header' });
      if (resolvedOpen) {
        rows.push(
          ...resolved.map((targetGroup) => ({
            kind: 'resolved-group' as const,
            group: targetGroup,
          })),
        );
      }
    }

    return rows;
  }, [pending, resolved, resolvedOpen, t]);

  const currentRowIndex = useMemo(() => {
    if (!currentKey) return -1;
    return listRows.findIndex((row) =>
      row.kind === 'pending-group' || row.kind === 'resolved-group'
        ? mentionGroupKey(row.group) === currentKey
        : false,
    );
  }, [currentKey, listRows]);

  useEffect(() => {
    if (!currentKey || currentRowIndex < 0) return;
    groupListRef.current?.scrollIntoView({
      index: currentRowIndex,
      align: 'center',
      behavior: 'auto',
    });
  }, [currentKey, currentRowIndex]);

  // Reclaim focus only if it's already somewhere inside this panel (e.g. on a button
  // that was just clicked) so j/k navigation keeps working after a decision. Never pull
  // focus away from the editor — a pending decision (accept/reject/etc.) can resolve after
  // the user has already clicked back into the document, and stealing focus there silently
  // breaks editor shortcuts like Shift+Backspace even though the caret still looks active.
  const rerender = () => {
    const active = document.activeElement;
    if (active && containerRef.current?.contains(active)) {
      containerRef.current.focus();
    }
    forceRender();
  };

  const checkedCandidates = filteredCandidates.filter((candidate) => checkedIds.has(candidate.id));
  const selected = mergeSelectedCandidates(checkedCandidates);
  const showCandidateUi = !!group && pendingInstances(group).length > 0;
  const currentWrapperNeedsPerson =
    !!instance && (wrapperNeedsPersonResolution(instance) || wrapperHasKeyConflict(instance));
  const aiSelectedCount = checkedCandidates.length;
  const aiStatus = useMemo(() => {
    if (!aiCuration || !group || !controller.isExpanded(group)) return null;
    // Loading and AI-curating states have their own dedicated banners at the top of the panel.
    if (loadingCandidates || rankingAi) return null;
    if (aiSuggestCreateNew) {
      return {
        severity: 'warning' as const,
        text: aiCreateRationale
          ? `AI suggests creating a new entity: ${aiCreateRationale}`
          : 'AI suggests creating a new entity.',
      };
    }
    if (aiSelectedCount > 0) {
      return {
        severity: 'success' as const,
        text:
          aiSelectedCount === 1
            ? 'AI pre-selected 1 candidate.'
            : `AI pre-selected ${aiSelectedCount} candidates.`,
      };
    }
    if (aiRanked) {
      return {
        severity: 'info' as const,
        text: 'AI reviewed these candidates and did not pre-select any.',
      };
    }
    return {
      severity: 'info' as const,
      text: 'AI curation is enabled for this group.',
    };
  }, [
    aiCreateRationale,
    aiCuration,
    aiRanked,
    aiSelectedCount,
    aiSuggestCreateNew,
    controller,
    group,
    loadingCandidates,
    rankingAi,
  ]);

  const afterChange = (targetGroup: MentionGroup) => {
    syncMentionGroupFromElements(targetGroup);
    controller.afterInstanceChange(targetGroup);
    rerender();
  };

  const acceptOccurrence = async () => {
    if (!instance || !selected || !group) return;
    try {
      await session.resolveMention(instance, selected);
      afterChange(group);
      controller.next();
      rerender();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const acceptDocumentSurface = async () => {
    if (!group || !selected || !instance) return;
    const sameDoc = group.instances.filter(
      (item) => !item.hasKey && item.documentId === instance.documentId,
    );
    try {
      await session.resolveMentions(sameDoc, selected);
      afterChange(group);
      controller.next();
      rerender();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Deliberately not memoized: its only consumer is `onKeyDown` on a plain Box
  // below, where a changing identity costs nothing (React's synthetic events add
  // no listener per render, and no memoized child receives it). The `useCallback`
  // this replaces never memoized anything anyway — `acceptOccurrence` and
  // `acceptDocumentSurface` are redefined every render, so its dependency array
  // changed every render too.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (handleDisambiguationKey(controller, event.key, { shift: event.shiftKey })) {
      event.preventDefault();
      forceRender();
      return;
    }
    if (event.key === 'Enter') {
      const target = event.target as HTMLElement;
      const isTextEntry =
        target.tagName === 'TEXTAREA' ||
        (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'checkbox');
      if (isTextEntry) return;
      if (selected) {
        event.preventDefault();
        void (event.shiftKey ? acceptDocumentSurface() : acceptOccurrence());
      }
    }
  };

  const markCurrentUnresolved = async () => {
    if (!instance || !group) return;
    try {
      await session.markUnresolved(instance, candidates);
      afterChange(group);
      controller.next();
      rerender();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const createNewEntity = async (description?: string, romanizedName?: string) => {
    if (!instance || !group) return;
    try {
      await session.resolveMention(
        instance,
        { id: 'new', label: instance.surface, sources: ['manual'] },
        { createNew: true, name: instance.surface, description, romanizedName },
      );
      afterChange(group);
      controller.next();
      rerender();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const confirmNewEntity = async () => {
    setNewEntityBusy(true);
    try {
      await createNewEntity(
        newEntityDescription.trim() || undefined,
        newEntityRomanized.trim() || undefined,
      );
      setNewEntityDialogOpen(false);
      setNewEntityDescription('');
      setNewEntityRomanized('');
    } finally {
      setNewEntityBusy(false);
    }
  };

  const submitManualLink = async () => {
    if (!instance || !group) return;
    setManualLinkError(null);
    setManualLinkBusy(true);
    try {
      const authorityId = await resolveManualAuthorityLink(manualLinkValue);
      if (!authorityId) {
        setManualLinkError(
          'Only Wikidata, Wikipedia, VIAF, DBPedia, Getty, GND, or Geonames links are accepted.',
        );
        return;
      }
      // Harvest the one-line description and life dates for the database entry.
      let summary: WikidataSummary | null = null;
      if (authorityId.type === 'Wikidata') {
        const qid = extractWikidataId(authorityId.value);
        if (qid) {
          try {
            summary = await fetchWikidataSummary(qid);
          } catch {
            summary = null;
          }
        }
      }
      await session.resolveMention(
        instance,
        {
          id: 'new',
          label: instance.surface,
          sources: ['manual'],
          authorityIds: [authorityId],
          description: summary?.description,
          startYear: summary?.birthYear,
          endYear: summary?.deathYear,
        },
        { createNew: true, name: instance.surface },
      );
      setManualLinkOpen(false);
      setManualLinkValue('');
      afterChange(group);
      controller.next();
      rerender();
    } catch (e) {
      setManualLinkError(e instanceof Error ? e.message : String(e));
    } finally {
      setManualLinkBusy(false);
    }
  };

  const redoOccurrence = async (target: MentionInstance, targetGroup: MentionGroup) => {
    try {
      await session.clearMentionResolution(target);
      afterChange(targetGroup);
      controller.selectGroup(mentionGroupKey(targetGroup), { focus: true, expand: true });
      rerender();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const redoDocumentSurface = async (targetGroup: MentionGroup, documentId: string) => {
    const targets = targetGroup.instances.filter(
      (item) => item.hasKey && item.documentId === documentId,
    );
    try {
      await session.clearMentionResolutions(targets);
      afterChange(targetGroup);
      controller.selectGroup(mentionGroupKey(targetGroup), { focus: true, expand: true });
      rerender();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const renderCandidateList = () => {
    if (!group) return null;
    // Loading and AI-curating status now surface as dedicated banners at the
    // top of the panel; avoid flashing "No candidates" while either is in flight.
    if (loadingCandidates) return null;
    if (candidates.length === 0) {
      return (
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.75, py: 0.5 }}>
          No candidates — try refresh.
        </Typography>
      );
    }
    if (filteredCandidates.length === 0) {
      return (
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.75, py: 0.5 }}>
          No candidates in the selected date range.
        </Typography>
      );
    }
    return (
      <>
        {displayCandidates.map((candidate) => {
          const checked = checkedIds.has(candidate.id);
          const links = candidateLinks(candidate);
          const syncToCentral = projectSyncsToCentral();
          const badgeSources = provenanceSourcesForBadges(candidate, links, syncToCentral);
          const confidence = aiConfidences[candidate.id];
          const appearsInDocument =
            !!candidate.localEntityId && keyedEntityIds.has(candidate.localEntityId);
          return (
            <Box
              key={candidate.id}
              onClick={() => toggleCandidate(candidate.id, !checked)}
              sx={{
                display: 'flex',
                gap: 0.25,
                alignItems: 'flex-start',
                py: 0.5,
                px: 0.75,
                cursor: 'pointer',
                borderLeft: '3px solid',
                borderLeftColor: checked ? 'primary.main' : 'transparent',
                bgcolor: checked ? 'action.selected' : appearsInDocument ? 'success.50' : undefined,
              }}
            >
              <Checkbox
                size="small"
                checked={checked}
                sx={{ p: 0, mt: 0.125 }}
                onMouseDown={stopRowClick}
                onClick={stopRowClick}
                onChange={(event) => toggleCandidate(candidate.id, event.target.checked)}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, flex: 1, minWidth: 0 }} noWrap>
                    {candidate.projectLangName ?? candidate.label}
                    {candidate.romanizedName &&
                      candidate.romanizedName !==
                        (candidate.projectLangName ?? candidate.label) && (
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: 0.75 }}
                        >
                          {candidate.romanizedName}
                        </Typography>
                      )}
                  </Typography>
                  {links.map((link) => (
                    <AuthorityLinkIcon key={link.url} link={link} />
                  ))}
                  {badgeSources.length > 0 && <SourceBadges label={badgeSources.join('+')} />}
                  {candidate.fromEntityFile && !syncToCentral && (
                    <Chip
                      label="local"
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: 10,
                        bgcolor: '#1b5e20',
                        color: '#fff',
                        fontWeight: 600,
                      }}
                    />
                  )}
                  {appearsInDocument && (
                    <Chip
                      label="already in document"
                      size="small"
                      color="success"
                      sx={{ height: 16, fontSize: 10, fontWeight: 600 }}
                    />
                  )}
                  {placeClusterLabelById &&
                    (placeClusterLabelById.has(candidate.id) ? (
                      <Tooltip title="Places within the proximity radius of each other share a letter — distinct letters are geographically distinct hits">
                        <Chip
                          icon={<RoomIcon sx={{ fontSize: 12 }} />}
                          label={placeClusterLabelById.get(candidate.id)}
                          size="small"
                          sx={{ height: 16, fontSize: 10, fontWeight: 600 }}
                        />
                      </Tooltip>
                    ) : (
                      <Tooltip title="This candidate has no coordinates — it can't be grouped by proximity">
                        <Chip
                          label="no geo data"
                          size="small"
                          variant="outlined"
                          sx={{ height: 16, fontSize: 10, color: 'text.secondary' }}
                        />
                      </Tooltip>
                    ))}
                  {confidence !== undefined && (
                    <Chip
                      label={getConfidenceLabel(confidence)}
                      size="small"
                      color={getValidationColor(confidence)}
                      title={`AI confidence: ${confidence.toFixed(2)}`}
                      sx={{ height: 16, fontSize: 10, fontWeight: 600 }}
                    />
                  )}
                </Box>
                {(() => {
                  const period = formatCandidatePeriod(candidate);
                  return period ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      sx={{ lineHeight: 1.3, fontWeight: 600 }}
                    >
                      {period}
                    </Typography>
                  ) : null;
                })()}
                {candidate.description && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    sx={{ lineHeight: 1.3 }}
                  >
                    {candidate.description}
                  </Typography>
                )}
                {aiRationales[candidate.id] && (
                  <Typography
                    variant="caption"
                    color="primary.main"
                    display="block"
                    sx={{ lineHeight: 1.3 }}
                  >
                    AI: {aiRationales[candidate.id]}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </>
    );
  };

  const renderPendingGroupBody = (targetGroup: MentionGroup) => {
    const instances = pendingInstances(targetGroup);
    const wrapperNeedsPerson = instances.some(wrapperNeedsPersonResolution);
    const wrapperConflict = instances.some(wrapperHasKeyConflict);
    return (
      <>
        {instances.map((item, index) => (
          <InstanceContext
            key={`${item.documentId}-${item.anchor.occurrence}-${item.anchor.nodeHash}`}
            instance={item}
            isCurrent={targetGroup === group && instance === item}
            onSelect={() => {
              controller.selectInstance(targetGroup, index);
              rerender();
            }}
          />
        ))}
        {targetGroup === group && wrapperNeedsPerson && (
          <Alert severity="error" sx={{ mx: 0.75, my: 0.5, py: 0.25 }}>
            Disambiguate the inner person name first. This wrapper cannot be resolved until its
            person is identified.
          </Alert>
        )}
        {targetGroup === group && wrapperConflict && (
          <Alert severity="error" sx={{ mx: 0.75, my: 0.5, py: 0.25 }}>
            The wrapper and its inner person have conflicting keys. Resolve the person again before
            accepting this wrapper.
          </Alert>
        )}
        {targetGroup === group && aiSuggestCreateNew && (
          <Alert severity="info" sx={{ mx: 0.75, my: 0.5, py: 0.25 }}>
            AI suggests creating a new entity
            {aiCreateRationale ? `: ${aiCreateRationale}` : '.'}
          </Alert>
        )}
        {targetGroup === group && renderCandidateList()}
      </>
    );
  };

  const renderResolvedGroupBody = (targetGroup: MentionGroup) => (
    <>
      {targetGroup.instances.map((item, index) => (
        <Box key={`${item.documentId}-${item.anchor.occurrence}-${item.anchor.nodeHash}`}>
          <InstanceContext
            instance={item}
            isCurrent={targetGroup === group && controller.currentInstance() === item}
            onSelect={() => {
              controller.selectInstance(targetGroup, index);
              rerender();
            }}
          />
          <Stack direction="row" spacing={0.5} sx={{ px: 0.75, pb: 0.5 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<UndoIcon sx={{ fontSize: 14 }} />}
              onClick={() => void redoOccurrence(item, targetGroup)}
              sx={{ fontSize: 11, py: 0.25 }}
            >
              Redo occurrence
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={() => void redoDocumentSurface(targetGroup, item.documentId)}
              sx={{ fontSize: 11, py: 0.25 }}
            >
              Redo all in document
            </Button>
          </Stack>
        </Box>
      ))}
    </>
  );

  return (
    <>
      <Box
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        data-testid="disambiguation-panel"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minWidth: 0,
          outline: 'none',
        }}
      >
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 0.5, py: 0 }}>
            {error}
          </Alert>
        )}

        {loadingCandidates && (
          <Alert severity="info" sx={{ mx: 0.75, mb: 0.5, py: 0.25, flexShrink: 0 }}>
            Reading authority data for this entity — this can take a moment…
          </Alert>
        )}

        {rankingAi && (
          <Alert
            severity={rateLimitRetry ? 'warning' : 'info'}
            sx={{ mx: 0.75, mb: 0.5, py: 0.25, flexShrink: 0 }}
          >
            {rateLimitRetry
              ? `AI rate limited — retrying in ${rateLimitSecondsLeft}s (attempt ${rateLimitRetry.attempt}/${rateLimitRetry.maxAttempts})…`
              : 'AI is curating candidates for this entity — this can take a moment…'}
          </Alert>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            mb: 0.5,
            flexShrink: 0,
            px: 0.75,
            height: 24,
          }}
        >
          <Tooltip
            title={
              dateFilterMode === 'none'
                ? 'Date filter off — click to limit candidates to the year range'
                : dateFilterMode === 'limit'
                  ? 'Limit: keep candidates overlapping the year range'
                  : 'Exclude: drop candidates born after the cutoff or much later on average'
            }
          >
            <IconButton
              size="small"
              aria-label="Toggle date filter mode"
              onClick={cycleDateFilterMode}
              sx={{ p: 0.25, flexShrink: 0 }}
            >
              {dateFilterMode === 'none' ? (
                <FilterAltOffIcon sx={{ fontSize: 16 }} />
              ) : (
                <FilterAltIcon
                  sx={{
                    fontSize: 16,
                    color: dateFilterMode === 'exclude' ? 'error.main' : 'primary.main',
                  }}
                />
              )}
            </IconButton>
          </Tooltip>
          <Slider
            size="small"
            min={AUTHORITY_YEAR_MIN}
            max={AUTHORITY_YEAR_MAX}
            step={1}
            value={yearRange}
            onChange={(_event, value) => setYearRange(value as [number, number])}
            onChangeCommitted={(_event, value) => commitYearRange(value as [number, number])}
            valueLabelDisplay="auto"
            getAriaLabel={(index) => (index === 0 ? 'Start year' : 'End year')}
            getAriaValueText={(value) => `${value} CE`}
            disabled={dateFilterMode === 'none'}
            sx={{ flex: 1, minWidth: 0, mx: 0.5 }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: '0.6875rem', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {Math.min(...yearRange)}–{Math.max(...yearRange)}
          </Typography>
        </Box>

        {group?.tag === 'placeName' && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mb: 0.5,
              flexShrink: 0,
              px: 0.75,
              height: 24,
            }}
          >
            <Tooltip title="Proximity radius — same-named places within this distance are treated as one candidate">
              <RoomIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
            </Tooltip>
            <Slider
              size="small"
              min={0}
              max={50}
              step={1}
              value={placeProximityKm}
              onChange={(_event, value) => setPlaceProximityKm(value as number)}
              onChangeCommitted={(_event, value) => commitPlaceProximityKm(value as number)}
              valueLabelDisplay="auto"
              getAriaLabel={() => 'Place proximity radius (km)'}
              getAriaValueText={(value) => `${value} km`}
              sx={{ flex: 1, minWidth: 0, mx: 0.5 }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.6875rem', flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              {placeProximityKm} km
            </Typography>
          </Box>
        )}

        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, flexShrink: 0, px: 0.75 }}
        >
          <Select
            size="small"
            value={tagFilter}
            displayEmpty
            onChange={(event) => setTagFilter(event.target.value)}
            sx={{ flex: 1, fontSize: 12 }}
          >
            <MenuItem value="">All tags</MenuItem>
            {tagOptions.map((tag) => (
              <MenuItem key={tag} value={tag}>
                {tag}
              </MenuItem>
            ))}
          </Select>
          {disambiguationAiEnabled && (
            <AiCurationToggle
              on={aiAlwaysOn || aiCuration}
              disabled={aiAlwaysOn}
              onClick={handleToggleAiCuration}
              title={
                aiAlwaysOn
                  ? 'AI curation is always on (set in AI API settings)'
                  : aiCuration
                    ? 'AI curation is on — click to turn off'
                    : 'AI curation is off — click to turn on'
              }
            />
          )}
          <IconButton
            size="small"
            aria-label="Refresh candidates"
            onClick={() => group && void loadCandidates(group, true)}
            disabled={loadingCandidates || !group}
          >
            <RefreshIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 0.75, mb: 0.5, flexShrink: 0 }}
        >
          {counts.pending} pending · {counts.resolved} resolved
          {group
            ? ` · ${group.tag === 'name' && group.instances[0]?.element.getAttribute('type') === 'personWrapper' ? 'person' : (TAG_TO_KIND[group.tag] ?? 'entity')}`
            : ''}
        </Typography>

        {aiCuration && (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            sx={{ px: 0.75, mb: 0.5, flexShrink: 0 }}
          >
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
            {cacheDisabled && (
              <Chip
                size="small"
                variant="outlined"
                label="Cache off"
                sx={{ height: 18, fontSize: 10 }}
              />
            )}
          </Stack>
        )}

        {aiStatus && (
          <Alert severity={aiStatus.severity} sx={{ mx: 0.75, mb: 0.5, py: 0.25, flexShrink: 0 }}>
            {aiStatus.text}
          </Alert>
        )}

        <Box sx={{ flex: 1, minHeight: 0 }} onClick={() => containerRef.current?.focus()}>
          <Virtuoso
            ref={groupListRef}
            data={listRows}
            overscan={600}
            itemContent={(_index, row) => {
              if (row.kind === 'empty') {
                return (
                  <Typography variant="caption" color="text.secondary" sx={{ px: 0.75, py: 0.5 }}>
                    {row.message}
                  </Typography>
                );
              }

              if (row.kind === 'resolved-header') {
                return (
                  <SectionHeaderRow
                    title={t('Resolved')}
                    count={resolved.length}
                    open={resolvedOpen}
                    onToggle={() => setResolvedOpen((open) => !open)}
                  />
                );
              }

              const targetGroup = row.group;
              const key = mentionGroupKey(targetGroup);
              const expanded = controller.isExpanded(targetGroup);
              const isCurrent = key === currentKey;
              const resolvedRow = row.kind === 'resolved-group';

              return (
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <GroupHeader
                    group={targetGroup}
                    isCurrent={isCurrent}
                    expanded={expanded}
                    resolved={resolvedRow}
                    onSelect={() => {
                      controller.selectGroup(key, { focus: true, expand: expanded });
                      rerender();
                    }}
                    onToggle={() => {
                      controller.toggleExpanded(targetGroup);
                      if (!expanded) controller.selectGroup(key, { focus: true, expand: true });
                      rerender();
                    }}
                    mapPins={mapPinsForGroup(targetGroup)}
                    onOpenMap={() =>
                      setMapModal({
                        title: `${targetGroup.surface} — compare clusters`,
                        pins: mapPinsForGroup(targetGroup),
                      })
                    }
                  />
                  <Collapse in={expanded}>
                    {resolvedRow
                      ? renderResolvedGroupBody(targetGroup)
                      : renderPendingGroupBody(targetGroup)}
                  </Collapse>
                </Box>
              );
            }}
            style={{ height: '100%' }}
          />
        </Box>

        {showCandidateUi && instance && (
          <Box
            sx={{
              flexShrink: 0,
              borderTop: 1,
              borderColor: 'divider',
              p: 0.75,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              minWidth: 0,
            }}
          >
            <Tooltip title="Accept this occurrence">
              <span>
                <Button
                  size="small"
                  variant="contained"
                  disabled={!selected}
                  startIcon={<CheckIcon sx={{ fontSize: 14 }} />}
                  onClick={() => void acceptOccurrence()}
                  sx={{ px: 1, minWidth: 0, fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  Occurrence
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Accept all matching mentions in this document">
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!selected}
                  startIcon={<CheckIcon sx={{ fontSize: 14 }} />}
                  onClick={() => void acceptDocumentSurface()}
                  sx={{ px: 1, minWidth: 0, fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  Document
                </Button>
              </span>
            </Tooltip>
            <Box sx={{ flex: 1, minWidth: 4 }} />
            <Stack direction="row" spacing={0.25} alignItems="center" flexShrink={0}>
              <Tooltip
                title={
                  currentWrapperNeedsPerson
                    ? 'Disambiguate the inner person name before creating an entity for this wrapper'
                    : aiSuggestCreateNew
                      ? 'AI suggests creating a new entity'
                      : 'Create new entity'
                }
              >
                <IconButton
                  size="small"
                  aria-label="Create new entity"
                  color={aiSuggestCreateNew ? 'warning' : 'default'}
                  disabled={currentWrapperNeedsPerson}
                  onClick={() => {
                    setNewEntityDescription('');
                    // People: Norbert (or default) surname split first, then
                    // romanize each part — "Xiao Dilie", not "Xiao Di Lie".
                    const kind =
                      instance?.tag === 'name' ? 'person' : TAG_TO_KIND[instance?.tag ?? ''];
                    const suggested =
                      instance &&
                      (kind === 'person'
                        ? suggestPersonRomanization(instance.surface, projectLang)
                        : autoRomanizeForKind(instance.surface, projectLang, kind));
                    setNewEntityRomanized(suggested ?? '');
                    setNewEntityDialogOpen(true);
                  }}
                >
                  <PersonAddIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Link to a known authority (Wikidata, Wikipedia, VIAF, …) — for entities with no reconcile match">
                <IconButton
                  size="small"
                  aria-label="Link to authority"
                  color={manualLinkOpen ? 'primary' : 'default'}
                  disabled={currentWrapperNeedsPerson}
                  onClick={() => {
                    setManualLinkOpen((open) => !open);
                    setManualLinkError(null);
                  }}
                >
                  <LinkIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Mark unresolved">
                <IconButton
                  size="small"
                  aria-label="Mark unresolved"
                  color="warning"
                  onClick={() => void markCurrentUnresolved()}
                >
                  <HelpOutlineIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Ignore">
                <IconButton
                  size="small"
                  aria-label="Ignore"
                  onClick={() => {
                    controller.ignoreCurrentGroup();
                    rerender();
                  }}
                >
                  <SkipNextIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Split group">
                <IconButton
                  size="small"
                  aria-label="Split group"
                  onClick={() => {
                    controller.splitCurrentInstance();
                    rerender();
                  }}
                >
                  <CallSplitIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        )}

        {showCandidateUi && manualLinkOpen && (
          <Box sx={{ flexShrink: 0, borderTop: 1, borderColor: 'divider', p: 0.75 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <TextField
                size="small"
                autoFocus
                placeholder="Paste a Wikidata, Wikipedia, or VIAF URL…"
                value={manualLinkValue}
                onChange={(event) => setManualLinkValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void submitManualLink();
                  }
                }}
                disabled={manualLinkBusy}
                sx={{ flex: 1, minWidth: 0, '& .MuiInputBase-input': { fontSize: 12, py: 0.5 } }}
              />
              <Button
                size="small"
                variant="contained"
                disabled={manualLinkBusy || !manualLinkValue.trim()}
                onClick={() => void submitManualLink()}
                sx={{ px: 1, minWidth: 0, fontSize: 12, whiteSpace: 'nowrap' }}
              >
                Link
              </Button>
            </Stack>
            {manualLinkError && (
              <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                {manualLinkError}
              </Typography>
            )}
          </Box>
        )}

        {showCandidateUi && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ px: 0.75, pb: 0.5, flexShrink: 0 }}
          >
            j/k navigate · Enter accept occurrence · Shift+Enter accept document
          </Typography>
        )}
      </Box>
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
      <PlaceComparisonMap
        open={mapModal != null}
        pins={mapModal?.pins ?? []}
        title={mapModal?.title ?? ''}
        onClose={() => setMapModal(null)}
      />
      <Dialog
        open={newEntityDialogOpen}
        onClose={() => !newEntityBusy && setNewEntityDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>New entity: {instance?.surface}</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Not in any authority. A one-line description helps disambiguate this entity later.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="e.g. legendary flood-taming ruler, founder of the Xia dynasty"
            value={newEntityDescription}
            onChange={(event) => setNewEntityDescription(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void confirmNewEntity();
              }
            }}
            disabled={newEntityBusy}
          />
          {(canAutoRomanize(projectLang) || newEntityRomanized) && (
            <TextField
              fullWidth
              size="small"
              label="Romanized name"
              helperText="Latin-script form, used for search"
              value={newEntityRomanized}
              onChange={(event) => setNewEntityRomanized(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void confirmNewEntity();
                }
              }}
              disabled={newEntityBusy}
              sx={{ mt: 2 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewEntityDialogOpen(false)} disabled={newEntityBusy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void confirmNewEntity()}
            disabled={newEntityBusy}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
