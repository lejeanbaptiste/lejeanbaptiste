import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  canAcceptDateSuggestion,
  dateCuratorDisplaySurface,
  defaultDateCandidateIndex,
  finalizeDateSuggestion,
  preAcceptUniqueDateSuggestions,
  priorAcceptedDates,
} from './dateCurator';
import {
  DATE_DETAIL_KEYS,
  dateAuthorityPackageLabel,
  dateEditorFields,
  toggleDateEditorField,
} from './dateEditor';
import type { DateEditorField, DateFieldKind } from './dateEditor';
import { handleReviewKey, ReviewController, type DecisionEvent } from './reviewController';
import type { Suggestion } from './types';
import { useDateAuthority } from '../dateAuthority/useDateAuthority';
import type { DateAuthorityIndex } from '../dateAuthority/types';

export interface DateCuratorPanelProps {
  suggestions: Suggestion[];
  onApply: (accepted: Suggestion[]) => void;
  onFocus?: (suggestion: Suggestion) => void;
  onDecision?: (event: DecisionEvent) => void;
  onClose?: () => void;
  onRecalculate?: () => void;
  refreshing?: boolean;
  /**
   * When true (resolve pass), finishing the last pending item applies accepted
   * dates and lets the host close the panel. Tag-only review leaves this off.
   */
  finishWhenIdle?: boolean;
  autoFocus?: boolean;
  busy?: boolean;
  authorityCiv?: readonly string[];
}

interface DateRowProps {
  suggestion: Suggestion;
  batch: Suggestion[];
  isCurrent?: boolean;
  selectedIndex: number | null;
  attachIndex: number | '';
  authority?: DateAuthorityIndex | null;
  onSelectCandidate: (index: number) => void;
  onSelectAttach: (index: number | '') => void;
  onSelect?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onUndo?: () => void;
  onPreview?: () => void;
  onToggleField?: (key: 'intercalary' | 'lp') => void;
}

const chipBase = {
  display: 'inline-flex',
  alignItems: 'center',
  px: 0.75,
  py: 0.2,
  borderRadius: 1,
  fontSize: '0.95rem',
  lineHeight: 1.35,
  whiteSpace: 'nowrap' as const,
};

/** Locked / already-decided source surface: dark green + white (inverted in dark mode). */
const sourceLockedSx = {
  ...chipBase,
  fontWeight: 600,
  bgcolor: (theme: { palette: { mode: string } }) =>
    theme.palette.mode === 'dark' ? '#fff' : 'success.dark',
  color: (theme: { palette: { mode: string } }) =>
    theme.palette.mode === 'dark' ? 'success.dark' : '#fff',
};

function kindSx(kind: DateFieldKind, disambiguated: boolean) {
  if (kind === 'out-of-bounds') {
    return {
      ...chipBase,
      color: 'text.disabled',
      bgcolor: 'transparent',
      borderBottom: '1px dashed',
      borderColor: 'divider',
    };
  }
  if (kind === 'locked') {
    return {
      ...chipBase,
      color: 'text.primary',
      bgcolor: 'action.hover',
      borderBottom: 'none',
    };
  }
  if (disambiguated) {
    return {
      ...chipBase,
      color: 'text.primary',
      bgcolor: 'success.light',
      borderBottom: 'none',
    };
  }
  return {
    ...chipBase,
    color: 'text.primary',
    bgcolor: 'transparent',
    borderBottom: '2px solid',
    borderColor: 'error.main',
  };
}

const DetailChip = ({
  field,
  disambiguated,
  onToggle,
}: {
  field: DateEditorField;
  disambiguated: boolean;
  onToggle?: () => void;
}) => {
  const interactive = field.editable && onToggle;
  const label = field.kind === 'out-of-bounds' ? '—' : field.value || '—';
  if (interactive) {
    return (
      <Box
        component="button"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        sx={{
          ...kindSx(field.kind, disambiguated),
          border: 0,
          cursor: 'pointer',
          font: 'inherit',
        }}
        title={field.label}
      >
        {label}
      </Box>
    );
  }
  return (
    <Box component="span" sx={kindSx(field.kind, disambiguated)} title={field.label}>
      {label}
    </Box>
  );
};

const AuthorityPackageChip = ({
  label,
  needsChoice,
  disambiguated,
  candidates,
  selectedIndex,
  onSelectCandidate,
}: {
  label: string;
  needsChoice: boolean;
  disambiguated: boolean;
  candidates: { displayLine: string }[];
  selectedIndex: number | null;
  onSelectCandidate: (index: number) => void;
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  if (!needsChoice) {
    return (
      <Box component="span" sx={kindSx(disambiguated ? 'resolved' : 'locked', disambiguated)} title="Emperor · era">
        {label}
      </Box>
    );
  }

  return (
    <>
      <Box
        component="button"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setAnchorEl(event.currentTarget);
        }}
        sx={{
          ...kindSx('resolved', false),
          border: 0,
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
        }}
        title="Choose emperor · era"
      >
        {selectedIndex == null ? label : candidates[selectedIndex]?.displayLine.split('=')[0]?.trim() || label}
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        onClick={(event) => event.stopPropagation()}
      >
        {candidates.map((candidate, index) => (
          <MenuItem
            key={`${index}-${candidate.displayLine}`}
            selected={index === selectedIndex}
            onClick={() => {
              onSelectCandidate(index);
              setAnchorEl(null);
            }}
          >
            {candidate.displayLine}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

const InheritPriorButton = ({
  suggestion,
  batch,
  attachIndex,
  requireChoice,
  onSelectAttach,
}: {
  suggestion: Suggestion;
  batch: Suggestion[];
  attachIndex: number | '';
  /** Unresolved relatives must pick a prior before accept. */
  requireChoice: boolean;
  onSelectAttach: (index: number | '') => void;
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const prior = priorAcceptedDates(batch, suggestion.id);
  if (prior.length === 0) return null;

  const selected =
    typeof attachIndex === 'number' ? prior.find((p) => p.index === attachIndex) : null;
  const needsPick = requireChoice && attachIndex === '';
  const tooltip = selected
    ? `Inherit from ${selected.surface} — click to change`
    : requireChoice
      ? 'Choose which prior date this relative date inherits from'
      : 'Change which prior date this inherits from (for flashbacks)';

  return (
    <>
      <Tooltip title={tooltip}>
        <IconButton
          size="small"
          color={needsPick ? 'error' : selected ? 'primary' : 'default'}
          data-testid={`inherit-prior-${suggestion.id}`}
          aria-label={tooltip}
          onClick={(event) => {
            event.stopPropagation();
            setAnchorEl(event.currentTarget);
          }}
          sx={{
            p: 0.35,
            ...(needsPick
              ? { outline: '2px solid', outlineColor: 'error.main', outlineOffset: 0 }
              : {}),
          }}
        >
          <EditOutlinedIcon sx={{ fontSize: '1rem' }} />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        onClick={(event) => event.stopPropagation()}
      >
        <MenuItem
          selected={attachIndex === ''}
          onClick={() => {
            onSelectAttach('');
            setAnchorEl(null);
          }}
        >
          {requireChoice ? 'None — pick a prior date' : 'Default — previous in sequence'}
        </MenuItem>
        {prior.map((item) => (
          <MenuItem
            key={item.index}
            selected={attachIndex === item.index}
            onClick={() => {
              onSelectAttach(item.index);
              setAnchorEl(null);
            }}
          >
            {item.surface} — {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

const DateRow = ({
  suggestion,
  batch,
  isCurrent,
  selectedIndex,
  attachIndex,
  authority,
  onSelectCandidate,
  onSelectAttach,
  onSelect,
  onAccept,
  onReject,
  onUndo,
  onPreview,
  onToggleField,
}: DateRowProps) => {
  const resolution = suggestion.dateResolution;
  const candidates = resolution?.candidates ?? [];
  const dateStatus = resolution?.status ?? 'unique';
  const isUnique = dateStatus === 'unique';
  const isUnresolved = dateStatus === 'unresolved';
  const needsPackageChoice = dateStatus === 'ambiguous' && candidates.length > 1;
  const acceptReady = canAcceptDateSuggestion(suggestion, selectedIndex);
  const disambiguated = suggestion.status === 'accepted';
  const isOpen = suggestion.status === 'pending';
  const editorFields = dateEditorFields(suggestion, selectedIndex, authority);
  // Open rows only: show locked/resolved detail slots; skip out-of-bounds dashes.
  const detailFields = isOpen
    ? editorFields.filter(
        (field) => DATE_DETAIL_KEYS.includes(field.key) && field.kind !== 'out-of-bounds',
      )
    : [];
  const packageLabel = dateAuthorityPackageLabel(suggestion, selectedIndex, authority);
  const displayLine =
    (selectedIndex != null ? candidates[selectedIndex]?.displayLine : undefined) ??
    (isUnique ? candidates[0]?.displayLine : undefined) ??
    suggestion.rationale ??
    '';
  const surface = dateCuratorDisplaySurface(suggestion);
  const inheritControl = (
    <InheritPriorButton
      suggestion={suggestion}
      batch={batch}
      attachIndex={attachIndex}
      requireChoice={isUnresolved}
      onSelectAttach={onSelectAttach}
    />
  );

  const showAcceptReject = !isUnique && suggestion.status !== 'unresolvable';

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
        px: 1,
        py: 0.75,
        cursor: 'pointer',
        borderLeft: isCurrent ? '3px solid' : '3px solid transparent',
        borderLeftColor: isCurrent ? 'primary.main' : 'transparent',
        bgcolor:
          suggestion.status === 'rejected'
            ? 'action.disabledBackground'
            : isCurrent
              ? 'action.hover'
              : undefined,
        opacity: suggestion.status === 'rejected' ? 0.55 : 1,
      }}
    >
      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
        {disambiguated || isUnique ? (
          <>
            <Box component="span" sx={sourceLockedSx} title={surface}>
              {surface}
            </Box>
            {inheritControl}
          </>
        ) : (
          <>
            <Typography
              component="span"
              sx={{ fontSize: '0.95rem', lineHeight: 1.35, fontWeight: 500 }}
            >
              {surface}
            </Typography>

            {isUnresolved ? null : (
              <AuthorityPackageChip
                label={packageLabel}
                needsChoice={needsPackageChoice}
                disambiguated={false}
                candidates={candidates}
                selectedIndex={selectedIndex}
                onSelectCandidate={onSelectCandidate}
              />
            )}
            {inheritControl}

            {detailFields.map((field) => (
              <DetailChip
                key={field.key}
                field={field}
                disambiguated={false}
                onToggle={
                  field.editable && (field.key === 'intercalary' || field.key === 'lp')
                    ? () => onToggleField?.(field.key as 'intercalary' | 'lp')
                    : undefined
                }
              />
            ))}
          </>
        )}

        {showAcceptReject && (
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25 }}>
            {suggestion.status === 'pending' && onAccept && onReject ? (
              <>
                <Tooltip
                  title={
                    isUnresolved
                      ? attachIndex === ''
                        ? 'Attach to a prior date, or reject'
                        : 'Accept (Enter)'
                      : acceptReady
                        ? 'Accept (Enter)'
                        : 'Choose an interpretation first'
                  }
                >
                  <span>
                    <IconButton
                      size="small"
                      color="success"
                      disabled={isUnresolved ? attachIndex === '' : !acceptReady}
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
            ) : (
              <>
                {suggestion.status === 'rejected' && onAccept ? (
                  <Tooltip title="Accept">
                    <IconButton
                      size="small"
                      color="success"
                      data-testid={`accept-${suggestion.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onAccept();
                      }}
                    >
                      <CheckIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : null}
                {suggestion.status === 'accepted' && !isUnique && onReject ? (
                  <Tooltip title="Reject">
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
                ) : null}
                {onUndo && suggestion.status !== 'pending' && !isUnique ? (
                  <Tooltip title="Back to pending (u)">
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
              </>
            )}
          </Box>
        )}
      </Box>

      {displayLine ? (
        <Typography
          variant="caption"
          color="text.secondary"
          component="div"
          sx={{ mt: 0.35, pl: 0.25 }}
        >
          {displayLine}
        </Typography>
      ) : null}
    </Box>
  );
};

export const DateCuratorPanel = ({
  suggestions,
  onApply,
  onFocus,
  onDecision,
  onClose,
  finishWhenIdle = false,
  autoFocus = true,
  busy = false,
  onRecalculate,
  refreshing: _refreshing = false,
  authorityCiv,
}: DateCuratorPanelProps) => {
  const { t } = useTranslation('LW');
  const { authority } = useDateAuthority(true, authorityCiv);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dateListRef = useRef<VirtuosoHandle>(null);
  const [candidateById, setCandidateById] = useState<Record<string, number | null>>({});
  const [attachById, setAttachById] = useState<Record<string, number | ''>>({});

  const prepared = useMemo(() => {
    preAcceptUniqueDateSuggestions(suggestions);
    return suggestions;
  }, [suggestions]);

  const controller = useMemo(
    () => new ReviewController(prepared, { onFocus, onDecision }),
    [prepared, onFocus, onDecision],
  );
  const snapshot = controller.snapshot();
  const didInitialRecalc = useRef(false);

  useEffect(() => {
    if (autoFocus) containerRef.current?.focus();
  }, [controller, autoFocus]);

  useEffect(() => {
    const nextCandidates: Record<string, number | null> = {};
    const nextAttach: Record<string, number | ''> = {};
    for (const suggestion of prepared) {
      if (!suggestion.dateResolution) continue;
      nextCandidates[suggestion.id] = defaultDateCandidateIndex(suggestion.dateResolution);
      const attach = suggestion.dateResolution.attachToDateIndex;
      nextAttach[suggestion.id] = typeof attach === 'number' ? attach : '';
    }
    setCandidateById(nextCandidates);
    setAttachById(nextAttach);
  }, [prepared]);

  // Unique dates are pre-accepted with attributes; re-run sequential resolve so
  // later relative years (四年, 三月, …) pick up that era context immediately.
  useEffect(() => {
    if (didInitialRecalc.current || !onRecalculate || busy) return;
    const hasAnchor = prepared.some(
      (suggestion) => suggestion.status === 'accepted' && suggestion.attributes,
    );
    const hasOpen = prepared.some((suggestion) => suggestion.status === 'pending');
    if (!hasAnchor || !hasOpen) return;
    didInitialRecalc.current = true;
    onRecalculate();
  }, [prepared, onRecalculate, busy]);

  const rerender = () => {
    const active = document.activeElement;
    if (active && containerRef.current?.contains(active)) {
      containerRef.current.focus();
    }
    forceRender();
  };

  const selectedIndexFor = (suggestion: Suggestion): number | null =>
    candidateById[suggestion.id] ?? defaultDateCandidateIndex(suggestion.dateResolution!) ?? null;

  const attachIndexFor = (suggestion: Suggestion): number | '' => attachById[suggestion.id] ?? '';

  const collectForApply = (includeUnreviewedPending: boolean): Suggestion[] => {
    const batch: Suggestion[] = [];
    for (const suggestion of prepared) {
      if (suggestion.status === 'rejected' || suggestion.status === 'unresolvable') continue;

      if (suggestion.status === 'accepted') {
        batch.push(suggestion);
        continue;
      }

      if (suggestion.status === 'pending' && includeUnreviewedPending) {
        const selected = selectedIndexFor(suggestion);
        if (!canAcceptDateSuggestion(suggestion, selected)) continue;
        if (suggestion.dateResolution?.status === 'unresolved' && attachIndexFor(suggestion) === '') {
          continue;
        }
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

  const finishIfIdle = () => {
    if (!finishWhenIdle || controller.pendingVisible().length > 0) return;
    const toApply = collectForApply(false);
    if (toApply.length > 0) onApply(toApply);
    else onClose?.();
  };

  const afterAccept = () => {
    // Refresh contingent fields for still-open rows (sexagenary, month, …).
    onRecalculate?.();
    finishIfIdle();
  };

  /** Choosing emperor·era (or any candidate) must re-anchor later relative dates. */
  const chooseCandidate = (suggestion: Suggestion, candidateIndex: number) => {
    setCandidateById((currentMap) => ({ ...currentMap, [suggestion.id]: candidateIndex }));
    finalizeDateSuggestion(suggestion, candidateIndex);
    rerender();
    onRecalculate?.();
  };

  /**
   * Pencil control: pick which earlier date supplies sequential context.
   * Used for flashbacks — skip intervening dates when re-resolving.
   */
  const chooseAttach = (suggestion: Suggestion, index: number | '') => {
    setAttachById((currentMap) => ({ ...currentMap, [suggestion.id]: index }));
    if (!suggestion.dateResolution) return;
    if (index === '') {
      delete suggestion.dateResolution.attachToDateIndex;
    } else {
      suggestion.dateResolution.attachToDateIndex = index;
    }
    // Re-open so recalculation refreshes this row from the chosen prior.
    if (suggestion.status === 'accepted') {
      suggestion.status = 'pending';
    }
    delete suggestion.attributes;
    rerender();
    onRecalculate?.();
  };

  const decidePending = (index: number, decision: 'accepted' | 'rejected') => {
    const pending = controller.pendingVisible();
    const suggestion = pending[index];
    if (!suggestion) return;

    if (decision === 'accepted') {
      const selected = selectedIndexFor(suggestion);
      if (!canAcceptDateSuggestion(suggestion, selected)) return;
      if (suggestion.dateResolution?.status === 'unresolved' && attachIndexFor(suggestion) === '') {
        return;
      }
      finalizeDateSuggestion(suggestion, selected);
      const attach = attachIndexFor(suggestion);
      if (attach !== '' && suggestion.dateResolution) {
        suggestion.dateResolution.attachToDateIndex = attach;
      }
    }

    controller.moveToPendingIndex(index);
    controller.decide(decision);
    rerender();
    if (decision === 'accepted') afterAccept();
    else finishIfIdle();
  };

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const key = event.key;
      if ((key === 'Enter' && !event.shiftKey) || key === 'a') {
        const pending = snapshot.pendingVisible;
        const index = pending.findIndex((s) => s === snapshot.current);
        if (index >= 0) {
          decidePending(index, 'accepted');
          event.preventDefault();
          return;
        }
      }
      if (handleReviewKey(controller, key, { shift: event.shiftKey })) {
        event.preventDefault();
        rerender();
        finishIfIdle();
      }
    },
    // decidePending closes over controller state — rerender on each render is intentional
    [controller, snapshot, prepared],
  );

  const undecideItem = (suggestion: Suggestion) => {
    if (suggestion.dateResolution?.status === 'unique') return;
    controller.undecideSuggestion(suggestion);
    rerender();
  };

  const changeDateDecision = (suggestion: Suggestion, decision: 'accepted' | 'rejected') => {
    if (suggestion.dateResolution?.status === 'unique' && decision === 'rejected') return;
    if (decision === 'accepted') {
      const selected = selectedIndexFor(suggestion);
      if (!canAcceptDateSuggestion(suggestion, selected)) return;
      if (suggestion.dateResolution?.status === 'unresolved' && attachIndexFor(suggestion) === '') {
        return;
      }
      finalizeDateSuggestion(suggestion, selected);
      const attach = attachIndexFor(suggestion);
      if (attach !== '' && suggestion.dateResolution) {
        suggestion.dateResolution.attachToDateIndex = attach;
      }
    }
    controller.changeDecision(suggestion, decision);
    rerender();
    if (decision === 'accepted') afterAccept();
  };

  const { counts, pendingVisible: pending, current } = snapshot;
  const needsReview = counts.pending;

  useEffect(() => {
    if (!current || !listRef.current) return;
    const index = prepared.indexOf(current);
    if (index >= 0)
      dateListRef.current?.scrollToIndex({ index, align: 'center', behavior: 'auto' });
  }, [current?.id, prepared]);

  const renderDateRow = (suggestion: Suggestion) => {
    const pendingIndex = pending.indexOf(suggestion);
    const isUnique = suggestion.dateResolution?.status === 'unique';
    return (
      <DateRow
        key={suggestion.id}
        suggestion={suggestion}
        batch={prepared}
        isCurrent={suggestion === current}
        selectedIndex={selectedIndexFor(suggestion)}
        attachIndex={attachIndexFor(suggestion)}
        authority={authority}
        onSelectCandidate={(candidateIndex) => {
          chooseCandidate(suggestion, candidateIndex);
        }}
        onSelectAttach={(index) => {
          chooseAttach(suggestion, index);
        }}
        onSelect={
          pendingIndex >= 0
            ? () => {
                controller.moveToPendingIndex(pendingIndex);
                forceRender();
              }
            : undefined
        }
        onAccept={
          !isUnique && suggestion.status === 'pending' && pendingIndex >= 0
            ? () => decidePending(pendingIndex, 'accepted')
            : !isUnique && suggestion.status === 'rejected'
              ? () => changeDateDecision(suggestion, 'accepted')
              : undefined
        }
        onReject={
          !isUnique && suggestion.status === 'pending' && pendingIndex >= 0
            ? () => decidePending(pendingIndex, 'rejected')
            : !isUnique && suggestion.status === 'accepted'
              ? () => changeDateDecision(suggestion, 'rejected')
              : undefined
        }
        onUndo={
          !isUnique && suggestion.status !== 'pending' ? () => undecideItem(suggestion) : undefined
        }
        onPreview={() => controller.preview(suggestion)}
        onToggleField={(key) => {
          toggleDateEditorField(suggestion, key);
          rerender();
          onRecalculate?.();
        }}
      />
    );
  };

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
          {needsReview} to decide · {counts.accepted} ready · {counts.rejected} rejected
        </Typography>
      </Box>

      <Box
        ref={listRef}
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        onClick={() => containerRef.current?.focus()}
      >
        {prepared.length > 0 ? (
          <Virtuoso
            ref={dateListRef}
            data={prepared}
            overscan={600}
            itemContent={(_index, suggestion) => renderDateRow(suggestion)}
            style={{ height: '100%' }}
          />
        ) : (
          <Typography variant="body2" sx={{ p: 2 }} color="text.secondary">
            Nothing to curate.
          </Typography>
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
          alignItems: 'center',
        }}
      >
        {onClose && (
          <Button size="small" onClick={onClose} disabled={busy}>
            {t('Close review')}
          </Button>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: 'auto', alignSelf: 'center' }}
        >
          j/k · Enter · Shift+Enter all same · Backspace · Shift+Backspace all same
        </Typography>
      </Box>
    </Box>
  );
};
