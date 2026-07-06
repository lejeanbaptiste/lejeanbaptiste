import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import UndoIcon from '@mui/icons-material/Undo';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  canAcceptDateSuggestion,
  dateCuratorDisplaySurface,
  defaultDateCandidateIndex,
  finalizeDateSuggestion,
  priorAcceptedDates,
} from './dateCurator';
import { handleReviewKey, ReviewController, type DecisionEvent } from './reviewController';
import type { Suggestion } from './types';

export interface DateCuratorPanelProps {
  suggestions: Suggestion[];
  onApply: (accepted: Suggestion[]) => void;
  onFocus?: (suggestion: Suggestion) => void;
  onDecision?: (event: DecisionEvent) => void;
  onClose?: () => void;
  autoFocus?: boolean;
  busy?: boolean;
}

const statusColor: Record<Suggestion['status'], 'default' | 'success' | 'error' | 'warning'> = {
  pending: 'default',
  accepted: 'success',
  rejected: 'error',
  unresolvable: 'warning',
};

const dateStatusLabel: Record<string, string> = {
  tagged: 'Tagged',
  unique: 'Unique',
  ambiguous: 'Ambiguous',
  unresolved: 'Needs context',
  range: 'Range',
};

interface DateRowProps {
  suggestion: Suggestion;
  batch: Suggestion[];
  isCurrent?: boolean;
  selectedIndex: number | null;
  attachIndex: number | '';
  onSelectCandidate: (index: number) => void;
  onSelectAttach: (index: number | '') => void;
  onSelect?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onUndo?: () => void;
  onPreview?: () => void;
}

const DateRow = ({
  suggestion,
  batch,
  isCurrent,
  selectedIndex,
  attachIndex,
  onSelectCandidate,
  onSelectAttach,
  onSelect,
  onAccept,
  onReject,
  onUndo,
  onPreview,
}: DateRowProps) => {
  const resolution = suggestion.dateResolution;
  const candidates = resolution?.candidates ?? [];
  const dateStatus = resolution?.status ?? 'unique';
  const prior = priorAcceptedDates(batch, suggestion.id);
  const acceptReady = canAcceptDateSuggestion(suggestion, selectedIndex);
  const displaySurface = dateCuratorDisplaySurface(suggestion);

  return (
    <Box
      role="listitem"
      data-testid={`date-curator-item-${suggestion.id}`}
      data-current={isCurrent || undefined}
      onClick={() => {
        onSelect?.();
        onPreview?.();
      }}
      sx={{
        p: 1,
        cursor: 'pointer',
        borderLeft: isCurrent ? '3px solid' : '3px solid transparent',
        borderLeftColor: isCurrent ? 'primary.main' : 'transparent',
        bgcolor: isCurrent ? 'action.selected' : undefined,
      }}
    >
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
          {displaySurface}
        </Typography>
        <Chip size="small" variant="outlined" label={dateStatusLabel[dateStatus] ?? dateStatus} />
        <Chip
          size="small"
          color={statusColor[suggestion.status]}
          label={suggestion.status}
          data-testid={`status-${suggestion.id}`}
        />
        {suggestion.status !== 'unresolvable' && (
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25 }}>
            {suggestion.status === 'pending' && onAccept && onReject ? (
              <>
                <Tooltip title={acceptReady ? 'Accept (Enter)' : 'Pick an interpretation first'}>
                  <span>
                    <IconButton
                      size="small"
                      color="success"
                      disabled={!acceptReady}
                      data-testid={`accept-${suggestion.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onAccept();
                      }}
                    >
                      <CheckIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Reject (Backspace)">
                  <IconButton
                    size="small"
                    color="error"
                    data-testid={`reject-${suggestion.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onReject();
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            ) : onUndo ? (
              <Tooltip title="Undo (u)">
                <IconButton
                  size="small"
                  data-testid={`undo-${suggestion.id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onUndo();
                  }}
                >
                  <UndoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
          </Box>
        )}
      </Box>

      <Typography variant="caption" color="text.secondary" component="div">
        …{suggestion.anchor.contextBefore}
        <b>{displaySurface}</b>
        {suggestion.anchor.contextAfter}…
      </Typography>

      {resolution && suggestion.status === 'pending' && (
        <Box sx={{ mt: 0.75 }} onClick={(event) => event.stopPropagation()}>
          {dateStatus === 'unique' && candidates[0] && (
            <Typography variant="body2" sx={{ color: 'success.main' }}>
              {candidates[0].displayLine}
            </Typography>
          )}

          {(dateStatus === 'ambiguous' || (dateStatus === 'unresolved' && candidates.length > 1)) && (
            <RadioGroup
              value={selectedIndex ?? ''}
              onChange={(_event, value) => onSelectCandidate(Number(value))}
            >
              {candidates.map((candidate, index) => (
                <FormControlLabel
                  key={index}
                  value={index}
                  control={<Radio size="small" />}
                  label={<Typography variant="body2">{candidate.displayLine}</Typography>}
                  sx={{ alignItems: 'flex-start', ml: 0 }}
                />
              ))}
            </RadioGroup>
          )}

          {dateStatus === 'unresolved' && (
            <>
              {candidates.length <= 1 && (
                <Alert severity="info" sx={{ py: 0.25, mt: 0.5 }}>
                  Relative date — attach to a prior date in this passage, or reject if it is not a
                  date.
                </Alert>
              )}
              {prior.length > 0 && (
                <FormControl size="small" fullWidth sx={{ mt: 0.75 }}>
                  <Select
                    displayEmpty
                    value={attachIndex}
                    onChange={(event) => {
                      const value = event.target.value as number | '';
                      onSelectAttach(value === '' ? '' : Number(value));
                    }}
                  >
                    <MenuItem value="">
                      <em>Attach to prior date (optional)</em>
                    </MenuItem>
                    {prior.map((item) => (
                      <MenuItem key={item.index} value={item.index}>
                        {item.surface} — {item.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </>
          )}
        </Box>
      )}

      {suggestion.status !== 'pending' && resolution?.selectedCandidateIndex != null && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
          {candidates[resolution.selectedCandidateIndex]?.displayLine}
        </Typography>
      )}
    </Box>
  );
};

interface DecisionGroupProps {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

const DecisionGroup = ({ title, count, open, onToggle, children }: DecisionGroupProps) => (
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
    <Collapse in={open}>{children}</Collapse>
  </Box>
);

export const DateCuratorPanel = ({
  suggestions,
  onApply,
  onFocus,
  onDecision,
  onClose,
  autoFocus = true,
  busy = false,
}: DateCuratorPanelProps) => {
  const { t } = useTranslation('LW');
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [acceptedOpen, setAcceptedOpen] = useState(false);
  const [rejectedOpen, setRejectedOpen] = useState(false);
  const [candidateById, setCandidateById] = useState<Record<string, number | null>>({});
  const [attachById, setAttachById] = useState<Record<string, number | ''>>({});

  const controller = useMemo(
    () => new ReviewController(suggestions, { onFocus, onDecision }),
    [suggestions, onFocus, onDecision],
  );

  useEffect(() => {
    if (autoFocus) containerRef.current?.focus();
  }, [controller, autoFocus]);

  useEffect(() => {
    const next: Record<string, number | null> = {};
    for (const suggestion of suggestions) {
      if (!suggestion.dateResolution) continue;
      next[suggestion.id] = defaultDateCandidateIndex(suggestion.dateResolution);
    }
    setCandidateById(next);
    setAttachById({});
  }, [suggestions]);

  const rerender = () => {
    containerRef.current?.focus();
    forceRender();
  };

  const selectedIndexFor = (suggestion: Suggestion): number | null =>
    candidateById[suggestion.id] ?? defaultDateCandidateIndex(suggestion.dateResolution!) ?? null;

  const attachIndexFor = (suggestion: Suggestion): number | '' => attachById[suggestion.id] ?? '';

  const decidePending = (index: number, decision: 'accepted' | 'rejected') => {
    const pending = controller.pendingVisible();
    const suggestion = pending[index];
    if (!suggestion) return;

    if (decision === 'accepted') {
      const selected = selectedIndexFor(suggestion);
      if (!canAcceptDateSuggestion(suggestion, selected)) return;
      finalizeDateSuggestion(suggestion, selected);
      const attach = attachIndexFor(suggestion);
      if (attach !== '' && suggestion.dateResolution) {
        suggestion.dateResolution.attachToDateIndex = attach;
      }
    }

    controller.moveToPendingIndex(index);
    controller.decide(decision);
    rerender();
  };

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const key = event.key;
      if ((key === 'Enter' && !event.shiftKey) || key === 'a') {
        const pending = controller.pendingVisible();
        const index = pending.findIndex((s) => s === controller.current());
        if (index >= 0) {
          decidePending(index, 'accepted');
          event.preventDefault();
          return;
        }
      }
      if (handleReviewKey(controller, key, { shift: event.shiftKey })) {
        event.preventDefault();
        rerender();
      }
    },
    // decidePending closes over controller state — rerender on each render is intentional
    [controller, suggestions],
  );

  const undecideItem = (suggestion: Suggestion) => {
    controller.undecideSuggestion(suggestion);
    rerender();
  };

  const collectForApply = (includeUnreviewedPending: boolean): Suggestion[] => {
    const batch: Suggestion[] = [];
    for (const suggestion of suggestions) {
      if (suggestion.status === 'rejected' || suggestion.status === 'unresolvable') continue;

      if (suggestion.status === 'accepted') {
        batch.push(suggestion);
        continue;
      }

      if (suggestion.status === 'pending' && includeUnreviewedPending) {
        const selected = selectedIndexFor(suggestion);
        if (!canAcceptDateSuggestion(suggestion, selected)) continue;
        finalizeDateSuggestion(suggestion, selected);
        const attach = attachIndexFor(suggestion);
        if (attach !== '' && suggestion.dateResolution) {
          suggestion.dateResolution.attachToDateIndex = attach;
        }
        suggestion.status = 'accepted';
        batch.push(suggestion);
      }
    }
    return batch;
  };

  const apply = () => {
    onApply(collectForApply(false));
    forceRender();
  };

  const applyAllRemaining = () => {
    onApply(collectForApply(true));
    forceRender();
  };

  const counts = controller.counts();
  const pending = controller.pendingVisible();
  const accepted = controller.acceptedVisible();
  const rejected = controller.rejectedVisible();
  const current = controller.current();
  const remainingCount = counts.pending + counts.accepted;

  useEffect(() => {
    if (!current || !listRef.current) return;
    listRef.current
      .querySelector(`[data-testid="date-curator-item-${current.id}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [current?.id]);

  return (
    <Box
      ref={containerRef}
      data-testid="date-curator-panel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', outline: 'none' }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1, flexShrink: 0 }}>
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          Curate dates
        </Typography>
        <Typography variant="caption" data-testid="date-curator-counts">
          {counts.pending} pending · {counts.accepted} accepted · {counts.rejected} rejected
        </Typography>
      </Box>

      <Box
        ref={listRef}
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        onClick={() => containerRef.current?.focus()}
      >
        <Box role="list" sx={{ flexGrow: 1 }}>
          {pending.map((suggestion, index) => (
            <DateRow
              key={suggestion.id}
              suggestion={suggestion}
              batch={suggestions}
              isCurrent={suggestion === current}
              selectedIndex={selectedIndexFor(suggestion)}
              attachIndex={attachIndexFor(suggestion)}
              onSelectCandidate={(candidateIndex) => {
                setCandidateById((current) => ({ ...current, [suggestion.id]: candidateIndex }));
              }}
              onSelectAttach={(attachIndex) => {
                setAttachById((current) => ({ ...current, [suggestion.id]: attachIndex }));
              }}
              onSelect={() => {
                controller.moveToPendingIndex(index);
                forceRender();
              }}
              onAccept={() => decidePending(index, 'accepted')}
              onReject={() => decidePending(index, 'rejected')}
              onPreview={() => controller.preview(suggestion)}
            />
          ))}
          {pending.length === 0 && accepted.length === 0 && rejected.length === 0 && (
            <Typography variant="body2" sx={{ p: 2 }} color="text.secondary">
              Nothing to curate.
            </Typography>
          )}
          {pending.length === 0 && (accepted.length > 0 || rejected.length > 0) && (
            <Typography variant="body2" sx={{ p: 2 }} color="text.secondary">
              No pending dates — apply tags or expand groups below.
            </Typography>
          )}
        </Box>

        {accepted.length > 0 && (
          <DecisionGroup
            title={t('Accepted')}
            count={accepted.length}
            open={acceptedOpen}
            onToggle={() => setAcceptedOpen((open) => !open)}
          >
            {accepted.map((suggestion) => (
              <DateRow
                key={suggestion.id}
                suggestion={suggestion}
                batch={suggestions}
                selectedIndex={selectedIndexFor(suggestion)}
                attachIndex={attachIndexFor(suggestion)}
                onSelectCandidate={() => undefined}
                onSelectAttach={() => undefined}
                onPreview={() => controller.preview(suggestion)}
                onUndo={() => undecideItem(suggestion)}
              />
            ))}
          </DecisionGroup>
        )}

        {rejected.length > 0 && (
          <DecisionGroup
            title={t('Rejected')}
            count={rejected.length}
            open={rejectedOpen}
            onToggle={() => setRejectedOpen((open) => !open)}
          >
            {rejected.map((suggestion) => (
              <DateRow
                key={suggestion.id}
                suggestion={suggestion}
                batch={suggestions}
                selectedIndex={selectedIndexFor(suggestion)}
                attachIndex={attachIndexFor(suggestion)}
                onSelectCandidate={() => undefined}
                onSelectAttach={() => undefined}
                onPreview={() => controller.preview(suggestion)}
                onUndo={() => undecideItem(suggestion)}
              />
            ))}
          </DecisionGroup>
        )}
      </Box>

      <Box
        sx={{
          display: 'flex',
          gap: 1,
          p: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <Button
          size="small"
          variant="contained"
          disabled={busy || remainingCount === 0}
          onClick={applyAllRemaining}
          data-testid="date-curator-apply-all"
        >
          {remainingCount > 0
            ? t('Apply all remaining ({{count}})', { count: remainingCount })
            : t('Apply all remaining ({{count}})', { count: 0 })}
        </Button>
        <Button
          size="small"
          variant="outlined"
          disabled={busy || counts.accepted === 0}
          onClick={apply}
          data-testid="date-curator-apply"
        >
          {counts.accepted > 0
            ? t('Apply accepted ({{count}})', { count: counts.accepted })
            : t('Apply accepted ({{count}})', { count: 0 })}
        </Button>
        {onClose && (
          <Button size="small" onClick={onClose} disabled={busy}>
            {t('Close review')}
          </Button>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
          j/k · Enter · Backspace reject
        </Typography>
      </Box>
    </Box>
  );
};
