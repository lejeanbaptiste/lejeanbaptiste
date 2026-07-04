import CheckIcon from '@mui/icons-material/Check';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WikipediaIcon } from '../icons/custom/Wikipedia';
import { openExternalUrl } from '../utilities/DOM';
import {
  buildDisambiguationCandidates,
  candidateLinks,
  collapseCrossAuthorityCandidates,
  enrichCandidateCrossRefs,
  mergeSelectedCandidates,
  preferredWikipediaSite,
  type CandidateLink,
  type DisambiguationCandidate,
} from './disambiguationCandidates';
import { DisambiguationController } from './disambiguationController';
import { TAG_TO_KIND } from './entities';
import { AutoTaggingSession } from './integration';
import type { MentionGroup } from './mentions';

export interface DisambiguationPanelProps {
  session: AutoTaggingSession;
  groups: MentionGroup[];
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
    {link.kind === 'wikipedia' ? (
      <WikipediaIcon sx={{ fontSize: 14 }} />
    ) : link.kind === 'cbdb' ? (
      <Typography component="span" variant="caption" sx={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>
        CBDB
      </Typography>
    ) : (
      <OpenInNewIcon sx={{ fontSize: 13 }} />
    )}
  </IconButton>
);

export const DisambiguationPanel = ({ session, groups }: DisambiguationPanelProps) => {
  const { i18n } = useTranslation();
  const wikiSite = preferredWikipediaSite(i18n.language);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const [candidates, setCandidates] = useState<DisambiguationCandidate[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string>('');

  const controller = useMemo(
    () =>
      new DisambiguationController(groups, {
        hideResolved: true,
        tag: tagFilter || null,
      }),
    [groups, tagFilter],
  );

  const group = controller.currentGroup();
  const instance = controller.currentInstance();

  const toggleCandidate = (candidateId: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(candidateId);
      else next.delete(candidateId);
      return next;
    });
  };

  const loadCandidates = useCallback(
    async (forceRefresh = false) => {
      if (!group) {
        setCandidates([]);
        return;
      }
      setLoadingCandidates(true);
      setError(null);
      try {
        const cached = session.getPendingCandidates(group.tag, group.surface);
        if (cached && !forceRefresh) {
          setCandidates(
            collapseCrossAuthorityCandidates(cached.map(enrichCandidateCrossRefs)),
          );
          return;
        }
        const entitiesDoc = session.getEntitiesDocument() ?? (await session.loadEntities());
        const cache = session.cache;
        if (!cache) throw new Error('Authority cache is unavailable.');
        const rows = await buildDisambiguationCandidates(
          entitiesDoc,
          group.tag,
          group.surface,
          cache,
          ['Wikidata', 'VIAF'],
          forceRefresh,
        );
        session.rememberPendingCandidates(group.tag, group.surface, rows);
        await session.savePendingCache();
        setCandidates(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setCandidates([]);
      } finally {
        setLoadingCandidates(false);
      }
    },
    [group, session],
  );

  useEffect(() => {
    void loadCandidates(false);
  }, [loadCandidates]);

  useEffect(() => {
    if (candidates.length === 1) {
      setCheckedIds(new Set([candidates[0]!.id]));
    } else {
      setCheckedIds(new Set());
    }
  }, [group?.surface, group?.tag, candidates]);

  const checkedCandidates = candidates.filter((candidate) => checkedIds.has(candidate.id));
  const selected = mergeSelectedCandidates(checkedCandidates);
  const visible = controller.visible();
  const tagOptions = [...new Set(groups.map((item) => item.tag))];

  const acceptOccurrence = async () => {
    if (!instance || !selected) return;
    try {
      await session.resolveMention(instance, selected);
      controller.next();
      forceRender();
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
      controller.next();
      forceRender();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const markCurrentUnresolved = async () => {
    if (!instance) return;
    try {
      await session.markUnresolved(instance, candidates);
      controller.next();
      forceRender();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const createNewEntity = async () => {
    if (!instance) return;
    try {
      await session.resolveMention(
        instance,
        { id: 'new', label: instance.surface, sources: ['manual'] },
        { createNew: true, name: instance.surface },
      );
      controller.next();
      forceRender();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 0.5, py: 0 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, flexShrink: 0 }}>
        <Select
          size="small"
          value={tagFilter}
          displayEmpty
          onChange={(event) => {
            setTagFilter(event.target.value);
            forceRender();
          }}
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
          onClick={() => void loadCandidates(true)}
          disabled={loadingCandidates}
        >
          <RefreshIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {!group || !instance ? (
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.75 }}>
          No mentions need disambiguation in the current filter.
        </Typography>
      ) : (
        <>
          <Box sx={{ px: 0.75, mb: 0.5, flexShrink: 0 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              {visible.length} left · {TAG_TO_KIND[group.tag] ?? 'entity'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {instance.surface}
              </Typography>
              <Chip size="small" label={group.tag} sx={{ height: 18, fontSize: 11 }} />
            </Box>
            {checkedIds.size > 1 && (
              <Typography variant="caption" color="text.secondary">
                {checkedIds.size} selected — merges authority ids
              </Typography>
            )}
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {loadingCandidates ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                <CircularProgress size={18} />
              </Box>
            ) : candidates.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ px: 0.75 }}>
                No candidates — try refresh.
              </Typography>
            ) : (
              candidates.map((candidate) => {
                const checked = checkedIds.has(candidate.id);
                const links = candidateLinks(candidate, { wikiSite });
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
                          {candidate.label}
                        </Typography>
                        {links.map((link) => (
                          <AuthorityLinkIcon key={link.url} link={link} />
                        ))}
                        {candidate.fromEntityFile && (
                          <Chip label="local" size="small" sx={{ height: 16, fontSize: 10 }} />
                        )}
                      </Box>
                      {candidate.description && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.3 }}>
                          {candidate.description}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>

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
              <Tooltip title="Create new entity">
                <IconButton size="small" aria-label="Create new entity" onClick={() => void createNewEntity()}>
                  <PersonAddIcon sx={{ fontSize: 18 }} />
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
                    forceRender();
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
                    forceRender();
                  }}
                >
                  <CallSplitIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        </>
      )}
    </Box>
  );
};
