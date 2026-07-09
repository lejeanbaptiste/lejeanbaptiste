import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthorityCache } from '../../../../packages/cwrc-leafwriter/src/autoTagging/authorityCache';
import {
  buildDisambiguationCandidates,
  extractWikidataId,
  mergeSelectedCandidates,
  resolveEntityInDocument,
  type DisambiguationCandidate,
} from '../../../../packages/cwrc-leafwriter/src/autoTagging/disambiguationCandidates';
import {
  addEntity,
  createEntitiesScaffold,
  parseEntities,
  type EntityKind,
} from '../../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import {
  entityStoreFromDesktop,
  type EntityStore,
} from '../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import { fetchWikidataWorkDetails } from '../../../../packages/cwrc-leafwriter/src/autoTagging/wikidataWorkDetails';

/** An entity-backed value: a name plus either an authority ref (URI) or a local-only key (entities.xml id). */
export interface EntityLookupValue {
  name: string;
  /** Authority URI (Wikidata/VIAF/…), when linked to an external authority record. */
  ref?: string;
  /** Local-only entities.xml id (bare, e.g. "person-000100"), when minted without an authority match. */
  key?: string;
}

interface LookupSession {
  store: EntityStore | null;
  entitiesDoc: Document;
  cache: AuthorityCache;
}

const createLookupSession = async (): Promise<LookupSession> => {
  const store = entityStoreFromDesktop();
  if (!store) {
    return {
      store: null,
      entitiesDoc: parseEntities(createEntitiesScaffold()),
      cache: new AuthorityCache(null, null),
    };
  }
  const api = window.electronAPI;
  const cacheApi = api
    ? {
        readFile: api.readFile,
        writeFile: api.writeFile,
        pathExists: api.pathExists,
        ensureDirectory: api.ensureDirectory,
      }
    : null;
  return {
    store,
    entitiesDoc: await store.loadEntities(),
    cache: new AuthorityCache(cacheApi, cacheApi ? store.authorityCacheDir : null),
  };
};

interface EntityLookupFieldProps {
  /** entities.xml kind this field mints/links against. */
  kind: EntityKind;
  /** Tag passed to buildDisambiguationCandidates (drives which authority packs/entity-file lists are searched). */
  tag: string;
  label: string;
  /** "single" caps at one linked value and replaces on accept (e.g. work title); "multi" is a growing pill list (e.g. authors). */
  mode: 'single' | 'multi';
  values: EntityLookupValue[];
  disabled?: boolean;
  onChange: (values: EntityLookupValue[]) => void;
  /**
   * kind: 'work' only — after linking to a Wikidata work, fetches P577/P50 and
   * offers the publication year + author entities for the caller to backfill
   * (e.g. into otherwise-empty work-date/author fields).
   */
  onWorkDetails?: (details: { workYear?: number; authors: EntityLookupValue[] }) => void;
}

/**
 * Entity-lookup field: search installed authorities + the local entity file,
 * multi-select candidates to merge cross-authority links onto one entity, or
 * mint a new local-only entity (canonical name + one-line description) when
 * nothing matches. Everything minted/linked here is stored in entities.xml.
 */
export const EntityLookupField = ({
  kind,
  tag,
  label,
  mode,
  values,
  disabled,
  onChange,
  onWorkDetails,
}: EntityLookupFieldProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<DisambiguationCandidate[] | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDescription, setCreateDescription] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const sessionRef = useRef<LookupSession | null>(null);

  const getSession = useCallback(async (): Promise<LookupSession> => {
    if (!sessionRef.current) {
      sessionRef.current = await createLookupSession();
    }
    return sessionRef.current;
  }, []);

  const resetLookup = () => {
    setCandidates(null);
    setCheckedIds(new Set());
    setLookupError(null);
    setCreateOpen(false);
    setCreateDescription('');
  };

  const handleSearch = async () => {
    const surface = query.trim();
    if (!surface || searching) return;
    setSearching(true);
    setLookupError(null);
    try {
      const session = await getSession();
      const rows = await buildDisambiguationCandidates(
        session.entitiesDoc,
        tag,
        surface,
        session.cache,
        ['Wikidata', 'VIAF'],
        false,
        window.electronAPI?.authorityPackRead,
      );
      setCandidates(rows);
      setCheckedIds(new Set());
    } catch {
      setLookupError(t('LWC.desktop.author_pill.lookup_failed'));
      setCandidates(null);
    } finally {
      setSearching(false);
    }
  };

  const setValue = (item: EntityLookupValue) => {
    if (mode === 'single') {
      onChange([item]);
    } else {
      if (values.some((v) => v.name === item.name && v.ref === item.ref && v.key === item.key)) return;
      onChange([...values, item]);
    }
    setQuery('');
    resetLookup();
  };

  const toggleChecked = (id: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const linkSelected = async () => {
    if (!candidates) return;
    const checked = candidates.filter((c) => checkedIds.has(c.id));
    const merged = mergeSelectedCandidates(checked);
    if (!merged) return;

    setValue({ name: merged.label, ref: merged.uri });

    try {
      const session = await getSession();
      if (!session.store) return;
      resolveEntityInDocument(
        session.entitiesDoc,
        {
          kind,
          name: merged.label,
          authorityIds: merged.authorityIds,
          description: merged.description,
          startYear: merged.startYear,
          endYear: merged.endYear,
        },
        merged,
      );

      if (kind === 'work' && onWorkDetails) {
        const qid = extractWikidataId(merged.uri ?? '');
        if (qid) {
          try {
            const details = await fetchWikidataWorkDetails(qid);
            if (details) {
              const authors = details.authors.map((author) => {
                resolveEntityInDocument(session.entitiesDoc, {
                  kind: 'person',
                  name: author.label,
                  authorityIds: [{ type: 'Wikidata', value: author.qid }],
                });
                return {
                  name: author.label,
                  ref: `https://www.wikidata.org/wiki/${author.qid}`,
                } as EntityLookupValue;
              });
              onWorkDetails({ workYear: details.publicationYear, authors });
            }
          } catch {
            // Best-effort enrichment; the work link itself already succeeded.
          }
        }
      }

      await session.store.saveEntities(session.entitiesDoc);
    } catch {
      // Entity database write failed — the field is still applied to the header.
    }
  };

  const confirmCreateNew = async () => {
    const name = query.trim();
    if (!name || createBusy) return;
    setCreateBusy(true);
    try {
      const session = await getSession();
      const description = createDescription.trim() || undefined;
      if (!session.store) {
        setValue({ name });
        return;
      }
      const { id } = addEntity(session.entitiesDoc, kind, { name, description });
      await session.store.saveEntities(session.entitiesDoc);
      setValue({ name, key: id });
    } catch {
      setValue({ name });
    } finally {
      setCreateBusy(false);
    }
  };

  const removeValue = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <Box>
      <Typography color="text.secondary" sx={{ mb: 0.5 }} variant="caption">
        {label}
      </Typography>

      {values.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 1 }}>
          {values.map((item, index) => (
            <Tooltip
              key={`${item.name}-${index}`}
              title={item.ref ?? (item.key ? `${t('LWC.desktop.author_pill.local_entity')}: ${item.key}` : t('LWC.desktop.author_pill.no_authority_link'))}
            >
              <Chip
                color={item.ref || item.key ? 'primary' : 'default'}
                disabled={disabled}
                label={item.name}
                onDelete={disabled ? undefined : () => removeValue(index)}
                size="small"
                variant={item.ref || item.key ? 'filled' : 'outlined'}
              />
            </Tooltip>
          ))}
        </Stack>
      )}

      {(mode === 'multi' || values.length === 0) && (
        <>
          <Stack alignItems="center" direction="row" spacing={0.5}>
            <TextField
              disabled={disabled}
              fullWidth
              label={label}
              onChange={(event) => {
                setQuery(event.target.value);
                resetLookup();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSearch();
                }
              }}
              placeholder={t('LWC.desktop.author_pill.type_name_search')}
              size="small"
              value={query}
            />
            <Tooltip title={t('LWC.desktop.author_pill.search_authorities')}>
              <span>
                <IconButton
                  disabled={disabled || !query.trim() || searching}
                  onClick={() => void handleSearch()}
                  size="small"
                >
                  {searching ? <CircularProgress size={18} /> : <SearchIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('LWC.desktop.author_pill.create_new')}>
              <span>
                <IconButton
                  disabled={disabled || !query.trim()}
                  onClick={() => setCreateOpen((v) => !v)}
                  size="small"
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          {lookupError && (
            <Typography color="error" sx={{ mt: 0.5 }} variant="caption">
              {lookupError}
            </Typography>
          )}

          {createOpen && (
            <Paper sx={{ mt: 0.5, p: 1 }} variant="outlined">
              <Stack spacing={1}>
                <Typography color="text.secondary" variant="caption">
                  {t('LWC.desktop.author_pill.create_new_help')}
                </Typography>
                <TextField
                  disabled
                  label={t('LWC.desktop.author_pill.canonical_name')}
                  size="small"
                  value={query}
                />
                <TextField
                  disabled={createBusy}
                  label={t('LWC.desktop.author_pill.one_line_description')}
                  onChange={(event) => setCreateDescription(event.target.value)}
                  size="small"
                  value={createDescription}
                />
                <Stack direction="row" justifyContent="flex-end" spacing={1}>
                  <Button disabled={createBusy} onClick={() => setCreateOpen(false)} size="small">
                    {t('LWC.commons.cancel')}
                  </Button>
                  <Button
                    disabled={createBusy}
                    onClick={() => void confirmCreateNew()}
                    size="small"
                    variant="contained"
                  >
                    {createBusy ? <CircularProgress size={16} /> : t('LWC.desktop.author_pill.add')}
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          )}

          {candidates !== null && (
            <Paper sx={{ maxHeight: 260, mt: 0.5, overflow: 'auto' }} variant="outlined">
              {candidates.length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 1 }} variant="body2">
                  {t('LWC.desktop.author_pill.no_matches')}
                </Typography>
              ) : (
                <>
                  <List dense disablePadding>
                    {candidates.map((candidate) => {
                      const checked = checkedIds.has(candidate.id);
                      return (
                        <ListItemButton
                          key={candidate.id}
                          onClick={() => toggleChecked(candidate.id, !checked)}
                          dense
                        >
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <Checkbox
                              checked={checked}
                              edge="start"
                              onChange={(event) => toggleChecked(candidate.id, event.target.checked)}
                              onClick={(event) => event.stopPropagation()}
                              size="small"
                              tabIndex={-1}
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={candidate.label}
                            secondary={[candidate.description, candidate.sources.join(', ')]
                              .filter(Boolean)
                              .join(' — ')}
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
                  <Stack direction="row" justifyContent="flex-end" sx={{ p: 0.5 }}>
                    <Button
                      disabled={checkedIds.size === 0}
                      onClick={() => void linkSelected()}
                      size="small"
                      variant="contained"
                    >
                      {checkedIds.size > 1
                        ? t('LWC.desktop.author_pill.link_selected_count', { count: checkedIds.size })
                        : t('LWC.desktop.author_pill.link_selected')}
                    </Button>
                  </Stack>
                </>
              )}
            </Paper>
          )}
        </>
      )}
    </Box>
  );
};
