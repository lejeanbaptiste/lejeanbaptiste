import AutorenewIcon from '@mui/icons-material/Autorenew';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LaunchIcon from '@mui/icons-material/Launch';
import MergeIcon from '@mui/icons-material/Merge';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Alert,
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
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Radio,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthorityId, EntityKind } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import {
  addEntityName,
  deleteEntity,
  detachAuthority,
  findAuthorityDuplicates,
  listEntities,
  markDuplicateIntentional,
  mergeEntities,
  renameEntityName,
  setEntityDescription,
  setNameType,
  setRomanizedName,
  type DuplicateGroup,
  type EntitySummary,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityOps';
import {
  ALL_NAME_TYPES,
  type NameTypeId,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/nameTypes';
import {
  entityStoreFromDesktop,
  type EntityStore,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
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
import { applyKeyRemapAcrossProjects, type KeyRemapSummary } from '../entityDb/applyKeyRemap';
import { authorityLookupUrl } from '../entityDb/authorityLinks';

/** Lower ordinal = older entity; the merge survivor defaults to the oldest id. */
const idOrdinal = (id: string): number => {
  const match = id.match(/(\d+)$/);
  return match ? parseInt(match[1]!, 10) : Number.MAX_SAFE_INTEGER;
};

const oldestId = (ids: string[]): string =>
  [...ids].sort((a, b) => idOrdinal(a) - idOrdinal(b))[0]!;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

export const SidebarDatabaseTab = ({ active = false }: SidebarDatabaseTabProps) => {
  const { t } = useTranslation();
  const { skipEntityDetachConfirm } = useAppState().ui;
  const { setSkipEntityDetachConfirm } = useActions().ui;
  const [store, setStore] = useState<EntityStore | null>(null);
  const [projectLang, setProjectLang] = useState<string | null>(null);
  const [entities, setEntities] = useState<EntitySummary[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
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
  const [editDescription, setEditDescription] = useState('');
  const [editRomanized, setEditRomanized] = useState('');
  const [editHadRomanized, setEditHadRomanized] = useState(false);
  const [editNameTypes, setEditNameTypes] = useState<Record<string, string>>({});
  const [editNewName, setEditNewName] = useState('');
  const [splitInfoOpen, setSplitInfoOpen] = useState(false);
  const [lastSummary, setLastSummary] = useState<KeyRemapSummary | null>(null);

  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; entity: EntitySummary } | null>(
    null,
  );

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
    if (!currentStore) {
      setEntities([]);
      setDuplicates([]);
      setWarnings([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const doc = await currentStore.loadEntities();
      setEntities(listEntities(doc));
      setDuplicates(findAuthorityDuplicates(doc));
      setWarnings(await loadOpenWarnings(currentStore));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount and refresh whenever the tab becomes visible (the project —
  // and with it the entity store — may not exist yet at app start).
  useEffect(() => {
    if (active || !store) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reload]);

  // Reload when the entity database changes on disk (external edit or another flow).
  useEffect(() => {
    if (!window.electronAPI?.onExternalFileChange || !store) return;
    const entitiesPath = store.entitiesPath.replace(/\\/g, '/');
    return window.electronAPI.onExternalFileChange((filePath: string) => {
      if (filePath.replace(/\\/g, '/') === entitiesPath) void reload();
    });
  }, [reload, store]);

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

  /**
   * Run a mutation against the entity file: load fresh, mutate, save, then
   * optionally propagate a key remap across every registered project.
   */
  const runMutation = useCallback(
    async (
      message: string,
      mutate: (doc: Document) => Record<string, string | null> | void,
    ) => {
      if (!store) return;
      setBusyMessage(message);
      try {
        const doc = await store.loadEntities();
        const remap = mutate(doc) ?? undefined;
        await store.saveEntities(doc);
        if (remap && Object.keys(remap).length > 0) {
          const summary = await applyKeyRemapAcrossProjects(store, remap);
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
    setMergeIds(null);
    void runMutation('Merging entities…', (doc) => mergeEntities(doc, mergeKeepId, dropIds).remap);
  };

  const requestDelete = (entity: EntitySummary) => {
    setConfirm({
      title: `Delete ${entity.names[0] ?? entity.id}?`,
      body:
        `This removes ${entity.id} from the entity database and strips its key from every tag ` +
        `in every project sharing this database. The tags themselves stay in your documents. ` +
        `Save open documents first.`,
      confirmLabel: 'Delete entity',
      destructive: true,
      onConfirm: () =>
        void runMutation('Deleting entity…', (doc) => {
          deleteEntity(doc, entity.id);
          return { [entity.id]: null };
        }),
    });
  };

  const requestDetach = (entity: EntitySummary, ref: AuthorityId) => {
    const detach = () =>
      void runMutation('Detaching authority…', (doc) => {
        detachAuthority(doc, entity.id, ref);
      });
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
    setEditEntity(entity);
    setEditCanonicalName(entity.names[0] ?? '');
    setEditingName(false);
    setEditDescription(entity.description ?? '');
    setEditRomanized(entity.romanized ?? '');
    setEditHadRomanized(Boolean(entity.romanized));
    setEditNameTypes(
      Object.fromEntries(entity.nameEntries.map((entry) => [entry.text, entry.type ?? ''])),
    );
    setEditNewName('');
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

  const saveEdit = () => {
    if (!editEntity) return;
    const id = editEntity.id;
    const canonicalName = editCanonicalName.trim();
    const description = editDescription;
    const romanized = editRomanized.trim();
    const romanizedChanged = romanized !== (editEntity.romanized ?? '');
    const nameTypeChanges = editEntity.nameEntries
      .filter((entry) => (editNameTypes[entry.text] ?? '') !== (entry.type ?? ''))
      .map((entry) => ({
        text: entry.text,
        type: (editNameTypes[entry.text] || null) as NameTypeId | null,
      }));
    const newName = editNewName.trim();
    setEditEntity(null);
    void runMutation('Saving entity…', (doc) => {
      if (canonicalName) renameEntityName(doc, id, canonicalName);
      setEntityDescription(doc, id, description);
      if (romanizedChanged) setRomanizedName(doc, id, romanized, projectLang);
      for (const change of nameTypeChanges) setNameType(doc, id, change.text, change.type);
      if (newName) addEntityName(doc, id, newName);
    });
  };

  const mergeDuplicateGroup = (group: DuplicateGroup) => {
    setMergeIds(group.entityIds);
    setMergeKeepId(oldestId(group.entityIds));
  };

  const markGroupIntentional = (group: DuplicateGroup) => {
    void runMutation('Marking as intentional…', (doc) => {
      markDuplicateIntentional(doc, group.entityIds);
    });
  };

  const entityById = (id: string) => entities.find((entity) => entity.id === id);

  /** Jump the list to one entity (search pins it, checkbox selects it). */
  const jumpToEntity = (id: string) => {
    setKindFilter('all');
    setSearch(`^${escapeRegExp(id)}$`);
    setSelected(new Set([id]));
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
      {/* Toolbar: search + filter + actions */}
      <Stack spacing={1} sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          fullWidth
          inputRef={searchInputRef}
          size="small"
          placeholder={t('LWC.desktop.sidebar.database.search_placeholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          error={!!regexError}
          helperText={regexError ? t('LWC.desktop.sidebar.database.invalid_regex', { detail: regexError }) : undefined}
          InputProps={{
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')} aria-label={t('LWC.desktop.sidebar.database.clear_search')}>
                  ×
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
        />
        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup
            exclusive
            size="small"
            value={kindFilter}
            onChange={(_event, value: EntityKind | 'all' | null) => {
              if (value) setKindFilter(value);
            }}
          >
            <ToggleButton value="all">{t('LWC.desktop.sidebar.database.entity_types.all')}</ToggleButton>
            <ToggleButton value="person">{t('LWC.desktop.sidebar.database.entity_types.person')}</ToggleButton>
            <ToggleButton value="place">{t('LWC.desktop.sidebar.database.entity_types.place')}</ToggleButton>
            <ToggleButton value="org">{t('LWC.desktop.sidebar.database.entity_types.organization')}</ToggleButton>
            <ToggleButton value="work">{t('LWC.desktop.sidebar.database.entity_types.work')}</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ flex: 1 }} />
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
              >
                {t('LWC.desktop.sidebar.database.merge')}
                {selected.size >= 2 ? ` (${selected.size})` : ''}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={t('LWC.desktop.sidebar.database.reload_entities')}>
            <IconButton size="small" onClick={() => void reload()} aria-label={t('LWC.desktop.sidebar.database.reload_entities')}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Duplicate-authority warning */}
      {duplicates.length > 0 && (
        <Alert severity="warning" icon={<WarningAmberIcon fontSize="small" />} sx={{ m: 1, py: 0 }}>
          <Typography variant="caption" component="div" sx={{ fontWeight: 600 }}>
              {duplicates.length === 1
              ? t('LWC.desktop.sidebar.database.duplicate_authority_one')
              : t('LWC.desktop.sidebar.database.duplicate_authority_many', { count: duplicates.length })}
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
                {group.entityIds
                  .map((id) => entityById(id)?.names[0] ?? id)
                  .join(', ')}
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
            const altNames = entity.names
              .slice(1)
              .filter((name) => name !== romanized);
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
                  {altNames.length > 0 && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {altNames.join(' · ')}
                    </Typography>
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary" component="div" noWrap>
                  {entity.id}
                  {entity.description ? ` — ${entity.description}` : ''}
                </Typography>
                {entity.authorities.length > 0 && (
                  <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.25 }}>
                    {entity.authorities.map((ref) => {
                      const url = authorityLookupUrl(ref);
                      return (
                        <Chip
                          key={`${ref.type}-${ref.value}`}
                          label={ref.type}
                          size="small"
                          variant="outlined"
                          icon={url ? <LaunchIcon sx={{ fontSize: 12 }} /> : undefined}
                          onClick={url ? () => openExternalUrl(url) : undefined}
                          onDelete={() => requestDetach(entity, ref)}
                          sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }}
                        />
                      );
                    })}
                  </Stack>
                )}
              </Box>
              <IconButton
                size="small"
                onClick={(event) => setMenuAnchor({ el: event.currentTarget, entity })}
                aria-label={t('LWC.desktop.sidebar.database.actions_for', { id: entity.id })}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
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

      {/* Per-entity menu */}
      <Menu
        anchorEl={menuAnchor?.el ?? null}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            if (menuAnchor) openEdit(menuAnchor.entity);
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('LWC.desktop.sidebar.database.edit_description_names')} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setSplitInfoOpen(true);
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <CallSplitIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('LWC.desktop.sidebar.database.split_entity')} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) requestDelete(menuAnchor.entity);
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primary={t('LWC.desktop.sidebar.database.delete_entity')} primaryTypographyProps={{ color: 'error' }} />
        </MenuItem>
      </Menu>

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
          <Button onClick={() => setConfirm(null)}>{t('LWC.desktop.sidebar.database.dialogs.cancel')}</Button>
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
        <DialogTitle>{t('LWC.desktop.sidebar.database.merge_dialog_title', { count: mergeIds?.length ?? 0 })}</DialogTitle>
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
          <Button onClick={() => setMergeIds(null)}>{t('LWC.desktop.sidebar.database.dialogs.cancel')}</Button>
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
                <Typography variant="h6" component="span" sx={{ minWidth: 0 }} noWrap>
                  {editCanonicalName || editEntity?.id}
                </Typography>
                <Tooltip title={t('LWC.desktop.sidebar.database.rename_name')}>
                  <IconButton
                    size="small"
                    onClick={startRename}
                    aria-label={t('LWC.desktop.sidebar.database.rename_name')}
                    sx={{ p: 0.25 }}
                  >
                    <EditOutlinedIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" component="div">
            {editEntity?.id}
          </Typography>
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
          {(canAutoRomanize(projectLang) || editHadRomanized) && (
            <TextField
              fullWidth
              size="small"
              label={t('LWC.desktop.sidebar.database.romanized_name')}
              helperText={t('LWC.desktop.sidebar.database.romanized_hint')}
              value={editRomanized}
              onChange={(event) => setEditRomanized(event.target.value)}
              sx={{ mt: 2 }}
              InputProps={{
                endAdornment: canAutoRomanize(projectLang) ? (
                  <InputAdornment position="end">
                    <Tooltip title={t('LWC.desktop.sidebar.database.generate_romanization')}>
                      <IconButton
                        size="small"
                        aria-label={t('LWC.desktop.sidebar.database.generate_romanization')}
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
            />
          )}
          {editEntity && editEntity.nameEntries.length > 1 && (
            <Stack spacing={0.75} sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {t('LWC.desktop.sidebar.database.name_types_heading')}
              </Typography>
              {editEntity.nameEntries
                .filter((entry) => entry.text !== editEntity.romanized)
                .map((entry) => (
                  <Stack key={entry.text} direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                      {entry.text}
                    </Typography>
                    <TextField
                      select
                      size="small"
                      value={editNameTypes[entry.text] ?? ''}
                      onChange={(event) =>
                        setEditNameTypes((previous) => ({
                          ...previous,
                          [entry.text]: event.target.value,
                        }))
                      }
                      sx={{ minWidth: 140, '& .MuiInputBase-input': { py: 0.5, fontSize: 12 } }}
                    >
                      <MenuItem value="">
                        <em>{t('LWC.desktop.sidebar.database.name_types.unclassified')}</em>
                      </MenuItem>
                      {ALL_NAME_TYPES.map((type) => (
                        <MenuItem key={type} value={type}>
                          {t(`LWC.desktop.sidebar.database.name_types.${type}`)}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                ))}
            </Stack>
          )}
          <TextField
            fullWidth
            size="small"
            label={t('LWC.desktop.sidebar.database.add_alternative_name')}
            value={editNewName}
            onChange={(event) => setEditNewName(event.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditEntity(null)}>{t('LWC.desktop.sidebar.database.dialogs.cancel')}</Button>
          <Button variant="contained" onClick={saveEdit}>
            {t('LWC.desktop.sidebar.database.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Split info */}
      <Dialog open={splitInfoOpen} onClose={() => setSplitInfoOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('LWC.desktop.sidebar.database.dialogs.splitting_entity')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('LWC.desktop.sidebar.database.dialogs.split_info_message')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSplitInfoOpen(false)}>{t('LWC.desktop.sidebar.database.dialogs.got_it')}</Button>
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
          <Button onClick={() => setLastSummary(null)}>{t('LWC.desktop.sidebar.database.dialogs.close')}</Button>
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
    </Box>
  );
};
