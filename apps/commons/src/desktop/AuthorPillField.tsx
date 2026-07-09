import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
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
  resolveEntityInDocument,
  type DisambiguationCandidate,
} from '../../../../packages/cwrc-leafwriter/src/autoTagging/disambiguationCandidates';
import {
  createEntitiesScaffold,
  parseEntities,
} from '../../../../packages/cwrc-leafwriter/src/autoTagging/entities';
import {
  entityStoreFromDesktop,
  type EntityStore,
} from '../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import type { SourceAuthor } from './sourceDescription';

interface AuthorPillFieldProps {
  authors: SourceAuthor[];
  disabled?: boolean;
  onChange: (authors: SourceAuthor[]) => void;
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

/**
 * Pill-style author entry: type a name, search authorities (same pipeline as
 * auto-tag disambiguation), accept a match to add it as a pill with @ref and
 * store it in the entity database — or add the raw name without a match.
 */
export const AuthorPillField = ({ authors, disabled, onChange }: AuthorPillFieldProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<DisambiguationCandidate[] | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const sessionRef = useRef<LookupSession | null>(null);

  const getSession = useCallback(async (): Promise<LookupSession> => {
    if (!sessionRef.current) {
      sessionRef.current = await createLookupSession();
    }
    return sessionRef.current;
  }, []);

  const resetLookup = () => {
    setCandidates(null);
    setLookupError(null);
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
        'persName',
        surface,
        session.cache,
        ['Wikidata', 'VIAF'],
        false,
        window.electronAPI?.authorityPackRead,
      );
      setCandidates(rows);
    } catch {
      setLookupError('Lookup failed — check your connection, or add the name without a match.');
      setCandidates(null);
    } finally {
      setSearching(false);
    }
  };

  const addAuthor = (author: SourceAuthor) => {
    if (!author.name.trim()) return;
    if (authors.some((a) => a.name === author.name && a.ref === author.ref)) return;
    onChange([...authors, author]);
    setQuery('');
    resetLookup();
  };

  const acceptCandidate = async (candidate: DisambiguationCandidate) => {
    addAuthor({ name: candidate.label, ref: candidate.uri });
    try {
      const session = await getSession();
      if (!session.store) return;
      resolveEntityInDocument(
        session.entitiesDoc,
        {
          kind: 'person',
          name: candidate.label,
          authorityIds: candidate.authorityIds,
          description: candidate.description,
          startYear: candidate.startYear,
          endYear: candidate.endYear,
        },
        candidate,
      );
      await session.store.saveEntities(session.entitiesDoc);
    } catch {
      // Entity database write failed — the author pill is still applied to the header.
    }
  };

  const removeAuthor = (index: number) => {
    onChange(authors.filter((_, i) => i !== index));
  };

  return (
    <Box>
      <Typography color="text.secondary" sx={{ mb: 0.5 }} variant="caption">
        Authors
      </Typography>

      {authors.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 1 }}>
          {authors.map((author, index) => (
            <Tooltip key={`${author.name}-${index}`} title={author.ref ?? 'No authority link'}>
              <Chip
                color={author.ref ? 'primary' : 'default'}
                disabled={disabled}
                label={author.name}
                onDelete={disabled ? undefined : () => removeAuthor(index)}
                size="small"
                variant={author.ref ? 'filled' : 'outlined'}
              />
            </Tooltip>
          ))}
        </Stack>
      )}

      <Stack alignItems="center" direction="row" spacing={0.5}>
        <TextField
          disabled={disabled}
          fullWidth
          label={t('LWC.desktop.author_pill.add_author')}
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
        <Tooltip title={t('LWC.desktop.author_pill.add_without_authority_match')}>
          <span>
            <IconButton
              disabled={disabled || !query.trim()}
              onClick={() => addAuthor({ name: query.trim() })}
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

      {candidates !== null && (
        <Paper sx={{ maxHeight: 220, mt: 0.5, overflow: 'auto' }} variant="outlined">
          {candidates.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 1 }} variant="body2">
              No matches — add the name without a match, or refine the spelling.
            </Typography>
          ) : (
            <List dense disablePadding>
              {candidates.map((candidate) => (
                <ListItemButton
                  key={candidate.id}
                  onClick={() => void acceptCandidate(candidate)}
                >
                  <ListItemText
                    primary={candidate.label}
                    secondary={[candidate.description, candidate.sources.join(', ')]
                      .filter(Boolean)
                      .join(' — ')}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Paper>
      )}
    </Box>
  );
};
