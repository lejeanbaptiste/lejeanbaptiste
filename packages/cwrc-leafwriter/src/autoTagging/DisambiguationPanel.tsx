import CheckIcon from '@mui/icons-material/Check';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
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
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
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
  collapseCrossAuthorityCandidates,
  enrichCandidateCrossRefs,
  extractWikidataId,
  mergeSelectedCandidates,
  type CandidateLink,
  type DisambiguationCandidate,
} from './disambiguationCandidates';
import { autoRomanize, canAutoRomanize } from '../utilities/romanize';
import { AUTHORITY_YEAR_MAX, AUTHORITY_YEAR_MIN } from './authoritySettings';
import {
  dateFilterFromSettings,
  disambiguationCachingDisabledFromSettings,
  persistDisambiguationDateFilter,
  readPersistedDisambiguationSettings,
  yearRangeFromSettings,
} from './disambiguationSettings';
import { normalizeDateRangeFilter, type DateFilterMode, type DateRangeFilter } from './packLoader';
import { resolveManualAuthorityLink } from './manualAuthorityLink';
import type { AuthorityCache } from './authorityCache';
import { fetchWikidataSummary, type WikidataSummary } from './wikidataDates';
import {
  DisambiguationController,
  handleDisambiguationKey,
  mentionGroupKey,
  pendingInstances,
  syncMentionGroupFromElements,
} from './disambiguationController';
import { TAG_TO_KIND } from './entities';
import { AutoTaggingSession } from './integration';
import {
  aiApiSettingsFromDesktop,
  createLlmClientFromSettings,
  isAiSuggestReady,
} from './llmClientFromSettings';
import { rankDisambiguationCandidates } from './llmDisambiguationRank';
import { getConfidenceLabel, getValidationColor } from './llmValidationRank';
import {
  createDefaultAiPromptProfilesState,
  getActiveAiPromptProfile,
  persistAiPromptProfiles,
  readAiPromptProfilesFromDesktop,
  type AiPromptProfilesState,
} from './aiPromptProfiles';
import { AiPromptEditorDialog } from '../dialogs/autoTagging/AiPromptEditorDialog';
import type { MentionGroup, MentionInstance } from './mentions';

export interface DisambiguationPanelProps {
  session: AutoTaggingSession;
  groups: MentionGroup[];
  /** When true, ask the configured model to pre-check candidates after lookup. */
  aiCuration?: boolean;
}

const stopRowClick = (event: { stopPropagation: () => void }) => event.stopPropagation();

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
        <ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : undefined, transition: '0.2s' }} />
      }
      sx={{ justifyContent: 'space-between', textTransform: 'none', px: 1, py: 0.5, borderRadius: 0 }}
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
}

const GroupHeader = ({
  group,
  isCurrent,
  expanded,
  resolved = false,
  onToggle,
  onSelect,
}: GroupHeaderProps) => {
  const pendingCount = pendingInstances(group).length;
  const entityKey = group.instances.find((item) => item.hasKey)?.element.getAttribute('key') ?? '';

  return (
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
        <ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : undefined, transition: '0.2s' }} />
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
        <Chip size="small" label={group.tag} sx={{ height: 18, fontSize: 10, '& .MuiChip-label': { fontWeight: 400 } }} />
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
    () => normalizeDateRangeFilter({ mode: dateFilterMode, start: yearRange[0], end: yearRange[1] }),
    [dateFilterMode, yearRange],
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
        const lang =
          (await window.__leafWriterProject?.getProjectSourceLanguage?.()) ?? null;
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
      setRateLimitSecondsLeft(Math.max(0, Math.ceil((rateLimitRetry.retryAtMs - Date.now()) / 1000)));
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
  const tagOptions = useMemo(() => [...new Set(groups.map((item) => item.tag))], [groups]);

  const toggleCandidate = (candidateId: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(candidateId);
      else next.delete(candidateId);
      return next;
    });
  };

  const applyAiRank = useCallback(
    async (_targetGroup: MentionGroup, rows: DisambiguationCandidate[], targetInstance: MentionInstance) => {
      setAiRationales({});
      setAiConfidences({});
      setAiSuggestCreateNew(false);
      setAiCreateRationale(null);
      setRateLimitRetry(null);
      setAiRanked(false);

      if (!aiCuration || rows.length === 0) return;

      const settings = aiApiSettingsFromDesktop();
      if (!settings || !isAiSuggestReady(settings)) return;

      setRankingAi(true);
      try {
        const doc = await session.getDocument();
        const client = createLlmClientFromSettings(settings);
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
        if (!rank) return;

        setAiRationales(rank.rationales);
        setAiConfidences(rank.confidences ?? {});
        if (rank.selectedCandidateIds.length > 0) {
          setCheckedIds(new Set(rank.selectedCandidateIds));
          setAiSuggestCreateNew(false);
        } else if (rank.suggestCreateNew) {
          setCheckedIds(new Set());
          setAiSuggestCreateNew(true);
          setAiCreateRationale(rank.createNewRationale ?? null);
        }
        setAiRanked(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setAiRanked(true);
      } finally {
        setRankingAi(false);
        setRateLimitRetry(null);
      }
    },
    [activePromptProfile, aiCuration, i18n.language, session],
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
      entitiesDoc: Document,
      retryWhenPending = false,
    ) => {
      const groupKey = mentionGroupKey(targetGroup);
      try {
        const rows = await buildDisambiguationCandidates(
          entitiesDoc,
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
                void refreshDilaDates(targetGroup, cache, entitiesDoc, false);
              }
            : undefined,
          projectLang,
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
    [cacheDisabled, projectLang, session],
  );

  const loadCandidates = useCallback(
    async (
      targetGroup: MentionGroup,
      forceRefresh = false,
      targetInstance?: MentionInstance | null,
    ) => {
      setLoadingCandidates(true);
      setError(null);
      setCandidates([]);
      setAiRationales({});
      setAiConfidences({});
      setAiSuggestCreateNew(false);
      setAiCreateRationale(null);
      try {
        const cached = cacheDisabled
          ? null
          : session.getPendingCandidates(targetGroup.tag, targetGroup.surface);
        if (cached && !forceRefresh) {
          const rows = collapseCrossAuthorityCandidates(cached.map(enrichCandidateCrossRefs));
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
              const entitiesDoc = session.getEntitiesDocument() ?? (await session.loadEntities());
              void refreshDilaDates(targetGroup, cacheForRefresh, entitiesDoc, true);
            })();
          }
          const inst = targetInstance ?? controllerRef.current?.currentInstance();
          if (inst) await applyAiRank(targetGroup, rows, inst);
          return;
        }
        const entitiesDoc = session.getEntitiesDocument() ?? (await session.loadEntities());
        const cache = session.cache;
        if (!cache) throw new Error('Authority cache is unavailable.');
        const groupKey = mentionGroupKey(targetGroup);
        const rows = await buildDisambiguationCandidates(
          entitiesDoc,
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
            void refreshDilaDates(targetGroup, cache, entitiesDoc);
          },
          projectLang,
        );
        if (!cacheDisabled) {
          session.rememberPendingCandidates(targetGroup.tag, targetGroup.surface, rows);
          await session.savePendingCache();
        }
        setCandidates(rows);
        const inst = targetInstance ?? controllerRef.current?.currentInstance();
        if (inst) await applyAiRank(targetGroup, rows, inst);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setCandidates([]);
      } finally {
        setLoadingCandidates(false);
      }
    },
    [applyAiRank, cacheDisabled, projectLang, refreshDilaDates, session],
  );

  useEffect(() => {
    if (!group || !controller.isExpanded(group)) {
      setCandidates([]);
      return;
    }
    void loadCandidates(group, false, instance);
  }, [group?.surface, group?.tag, group && controller.isExpanded(group), instance, loadCandidates]);

  useEffect(() => {
    setManualLinkOpen(false);
    setManualLinkValue('');
    setManualLinkError(null);
  }, [group?.surface, group?.tag, instance]);

  const filteredCandidates = useMemo(
    () => candidates.filter((candidate) => candidatePassesYearFilter(candidate, dateFilter)),
    [candidates, dateFilter],
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
  }, [aiCuration, aiRationales, aiSuggestCreateNew, group?.surface, group?.tag, filteredCandidates]);

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
        message: 'No mentions need disambiguation in the current filter.',
      });
      return rows;
    }

    if (pending.length === 0 && resolved.length > 0) {
      rows.push({
        kind: 'empty',
        message: 'No pending items — expand resolved below to review or redo.',
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
  }, [pending, resolved, resolvedOpen]);

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

  const rerender = () => {
    containerRef.current?.focus();
    forceRender();
  };

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (handleDisambiguationKey(controller, event.key, { shift: event.shiftKey })) {
        event.preventDefault();
        forceRender();
      }
    },
    [controller],
  );

  const checkedCandidates = filteredCandidates.filter((candidate) => checkedIds.has(candidate.id));
  const selected = mergeSelectedCandidates(checkedCandidates);
  const showCandidateUi = !!group && pendingInstances(group).length > 0;
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
        setManualLinkError('Only Wikidata, Wikipedia, VIAF, DBPedia, Getty, GND, or Geonames links are accepted.');
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
        {filteredCandidates.map((candidate) => {
          const checked = checkedIds.has(candidate.id);
          const links = candidateLinks(candidate);
          const confidence = aiConfidences[candidate.id];
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
                bgcolor: checked ? 'action.selected' : undefined,
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
                      candidate.romanizedName !== (candidate.projectLangName ?? candidate.label) && (
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
                  {candidate.fromEntityFile && (
                    <Chip
                      label="local"
                      size="small"
                      sx={{ height: 16, fontSize: 10, bgcolor: '#1b5e20', color: '#fff', fontWeight: 600 }}
                    />
                  )}
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
                {candidate.description && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.3 }}>
                    {candidate.description}
                  </Typography>
                )}
                {aiRationales[candidate.id] && (
                  <Typography variant="caption" color="primary.main" display="block" sx={{ lineHeight: 1.3 }}>
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
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, outline: 'none' }}
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
                : 'Exclude: drop candidates overlapping the year range'
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
                sx={{ fontSize: 16, color: dateFilterMode === 'exclude' ? 'error.main' : 'primary.main' }}
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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, flexShrink: 0, px: 0.75 }}>
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
        <IconButton
          size="small"
          aria-label="Refresh candidates"
          onClick={() => group && void loadCandidates(group, true)}
          disabled={loadingCandidates || !group}
        >
          <RefreshIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ px: 0.75, mb: 0.5, flexShrink: 0 }}>
        {counts.pending} pending · {counts.resolved} resolved
        {group ? ` · ${TAG_TO_KIND[group.tag] ?? 'entity'}` : ''}
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
            <Chip size="small" variant="outlined" label="Cache off" sx={{ height: 18, fontSize: 10 }} />
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
                />
                <Collapse in={expanded}>
                  {resolvedRow ? renderResolvedGroupBody(targetGroup) : renderPendingGroupBody(targetGroup)}
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
            <Tooltip title={aiSuggestCreateNew ? 'AI suggests creating a new entity' : 'Create new entity'}>
              <IconButton
                size="small"
                aria-label="Create new entity"
                color={aiSuggestCreateNew ? 'warning' : 'default'}
                onClick={() => {
                  setNewEntityDescription('');
                  setNewEntityRomanized(
                    (instance && autoRomanize(instance.surface, projectLang)) ?? '',
                  );
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
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.75, pb: 0.5, flexShrink: 0 }}>
          j/k navigate · Enter accept (buttons)
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
            disabled={newEntityBusy}
            sx={{ mt: 2 }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setNewEntityDialogOpen(false)} disabled={newEntityBusy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void confirmNewEntity()} disabled={newEntityBusy}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
};
