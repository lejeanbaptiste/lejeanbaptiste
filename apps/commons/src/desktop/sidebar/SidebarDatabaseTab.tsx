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
import type { AuthorityId, EntityKind } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import {
  addEntityName,
  deleteEntity,
  detachAuthority,
  findAuthorityDuplicates,
  listEntities,
  markDuplicateIntentional,
  mergeEntities,
  setEntityDescription,
  type DuplicateGroup,
  type EntitySummary,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityOps';
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
  const { skipEntityDetachConfirm } = useAppState().ui;
  const { setSkipEntityDetachConfirm } = useActions().ui;
  const [store, setStore] = useState<EntityStore | null>(null);
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
  const [editDescription, setEditDescription] = useState('');
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

  const visible = useMemo(() => {
    return entities.filter((entity) => {
      if (kindFilter !== 'all' && entity.kind !== kindFilter) return false;
      if (!regex) return true;
      const haystacks = [entity.id, ...entity.names, entity.description ?? ''];
      return haystacks.some((text) => regex.test(text));
    });
  }, [entities, kindFilter, regex]);

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
    setEditDescription(entity.description ?? '');
    setEditNewName('');
  };

  const saveEdit = () => {
    if (!editEntity) return;
    const id = editEntity.id;
    const description = editDescription;
    const newName = editNewName.trim();
    setEditEntity(null);
    void runMutation('Saving entity…', (doc) => {
      setEntityDescription(doc, id, description);
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
          Open a project to browse its entity database.
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
          placeholder="Search (regex) — name, id, description"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          error={!!regexError}
          helperText={regexError ? `Invalid regex: ${regexError}` : undefined}
          InputProps={{
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')} aria-label="Clear search">
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
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="person">Per</ToggleButton>
            <ToggleButton value="place">Pla</ToggleButton>
            <ToggleButton value="org">Org</ToggleButton>
            <ToggleButton value="work">Wrk</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={selected.size >= 2 ? `Merge ${selected.size} entities` : 'Select 2+ entities to merge, or click to add an |alternative to the search'}>
            <span>
              <Button
                size="small"
                startIcon={<MergeIcon />}
                variant={selected.size >= 2 ? 'contained' : 'outlined'}
                onClick={handleMergeClick}
              >
                Merge{selected.size >= 2 ? ` (${selected.size})` : ''}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Reload database">
            <IconButton size="small" onClick={() => void reload()} aria-label="Reload entities">
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
              ? 'Two entities share the same authority id'
              : `${duplicates.length} authority ids are shared by several entities`}
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
                Merge
              </Button>
              <Button size="small" onClick={() => markGroupIntentional(group)}>
                Intentional
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
              ? '1 lookup warning to review'
              : `${warnings.length} lookup warnings to review`}
          </Typography>
          {warnings.map((warning) => (
            <Box key={warningKey(warning)} sx={{ mt: 0.5 }}>
              <Tooltip title={warning.detail ?? ''}>
                <Typography variant="caption" component="div">
                  {warning.kind === 'concordance-conflict'
                    ? `${warning.authority} ${warning.value} matched several entities — possible duplicates:`
                    : `A lookup implied ${warning.authority} ${warning.value}, but the entity already carries a different ${warning.authority} id — verify, or split the entity:`}
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
                    Review
                  </Button>
                )}
                <Button size="small" onClick={() => dismissWarning(warning)}>
                  Dismiss
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
            {entities.length === 0 ? 'The entity database is empty.' : 'No entities match.'}
          </Typography>
        ) : (
          visible.map((entity) => (
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
                  {entity.names.length > 1 && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {entity.names.slice(1).join(' · ')}
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
                aria-label={`Actions for ${entity.id}`}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Box>
          ))
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
          <ListItemText primary="Edit description / names" />
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
          <ListItemText primary="Split entity…" />
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
          <ListItemText primary="Delete entity" primaryTypographyProps={{ color: 'error' }} />
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
              label="Don't warn me about detaching again"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
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
        <DialogTitle>Merge {mergeIds?.length} entities</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            Names, authority ids, and descriptions are combined onto the surviving entity. Every
            tag in every project sharing this database is rewritten to the surviving key. Save
            open documents first.
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
            The selected entry survives; the others are folded into it.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMergeIds(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmMerge}>
            Merge
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editEntity} onClose={() => setEditEntity(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {editEntity?.names[0] ?? editEntity?.id}
          <Typography variant="caption" color="text.secondary" component="div">
            {editEntity?.id}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            label="One-line description"
            value={editDescription}
            onChange={(event) => setEditDescription(event.target.value)}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Add a name for matching (alternative name)"
            value={editNewName}
            onChange={(event) => setEditNewName(event.target.value)}
            helperText={
              editEntity && editEntity.names.length > 0
                ? `Current: ${editEntity.names.join(' · ')}`
                : undefined
            }
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditEntity(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Split info */}
      <Dialog open={splitInfoOpen} onClose={() => setSplitInfoOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Splitting an entity</DialogTitle>
        <DialogContent>
          <DialogContentText>
            There is no automatic split: the database cannot know which mentions belong to which
            of the two people. The reliable way is to delete this entity (tags stay, keys are
            stripped) and re-run tagging or re-link the mentions — each group to its own new
            entity.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSplitInfoOpen(false)}>Got it</Button>
        </DialogActions>
      </Dialog>

      {/* Post-remap summary */}
      <Dialog open={!!lastSummary} onClose={() => setLastSummary(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Keys updated</DialogTitle>
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
          <Button onClick={() => setLastSummary(null)}>Close</Button>
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
