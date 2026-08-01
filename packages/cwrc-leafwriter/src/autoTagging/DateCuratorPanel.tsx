import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import UndoIcon from '@mui/icons-material/Undo';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  canAcceptDateSuggestion,
  defaultDateCandidateIndex,
  finalizeDateSuggestion,
} from './dateCurator';
import { dateEditorFields, toggleDateEditorField, updateDateEditorField } from './dateEditor';
import { updateDateAuthorityField } from './dateEditor';
import type { DateEditorField, DateEditorKey } from './dateEditor';
import { handleReviewKey, ReviewController, type DecisionEvent } from './reviewController';
import type { Suggestion } from './types';
import { useDateAuthority } from '../dateAuthority/useDateAuthority';
import { matchesSearchText } from '../dateAuthority/search';
import type {
  DateAuthorityIndex,
  DynastyAuthorityEntry,
  EraAuthorityEntry,
  RulerAuthorityEntry,
} from '../dateAuthority/types';

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
  isCurrent?: boolean;
  selectedIndex: number | null;
  authority?: DateAuthorityIndex | null;
  onSelectCandidate?: (index: number) => void;
  onSelect?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onUndo?: () => void;
  onPreview?: () => void;
  onEditField?: (key: DateEditorKey, value?: string) => void;
  onEditAuthority?: (
    key: 'dyn' | 'ruler' | 'era',
    entry: DynastyAuthorityEntry | RulerAuthorityEntry | EraAuthorityEntry,
  ) => void;
}

const isAuthorityKey = (key: DateEditorKey): key is 'dyn' | 'ruler' | 'era' =>
  key === 'dyn' || key === 'ruler' || key === 'era';

const authorityEntryId = (
  key: 'dyn' | 'ruler' | 'era',
  entry: DynastyAuthorityEntry | RulerAuthorityEntry | EraAuthorityEntry,
): number => {
  if (key === 'dyn') return (entry as DynastyAuthorityEntry).dynId;
  if (key === 'ruler') return (entry as RulerAuthorityEntry).rulerId;
  return (entry as EraAuthorityEntry).eraId;
};

const InlineAuthorityField = ({
  field,
  id,
  options,
  onCommit,
}: {
  field: DateEditorField;
  id: string;
  options: Array<DynastyAuthorityEntry | RulerAuthorityEntry | EraAuthorityEntry>;
  onCommit: (entry: DynastyAuthorityEntry | RulerAuthorityEntry | EraAuthorityEntry) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(field.value);
  const listId = `date-authority-${id}`;
  const filteredOptions = options.filter((entry) => matchesSearchText(entry.searchText, value));

  useEffect(() => setValue(field.value), [field.value]);

  if (!editing) {
    return (
      <Typography
        component="button"
        type="button"
        variant="caption"
        onClick={(event) => {
          event.stopPropagation();
          setEditing(true);
        }}
        sx={{
          border: 0,
          borderBottom: '1px dashed',
          borderColor: 'warning.main',
          background: 'none',
          color: field.value ? 'warning.dark' : 'text.disabled',
          cursor: 'text',
          p: 0,
          font: 'inherit',
        }}
        title={`Edit ${field.label}`}
      >
        {field.value || '—'}
      </Typography>
    );
  }

  return (
    <>
      <input
        autoFocus
        aria-label={field.label}
        list={listId}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => {
          const match = options.find(
            (entry) =>
              entry.label === value ||
              ('labelSimp' in entry && entry.labelSimp === value) ||
              String(authorityEntryId(field.key as 'dyn' | 'ruler' | 'era', entry)) === value,
          );
          if (match) onCommit(match);
          setEditing(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') setEditing(false);
        }}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: `${Math.max(3, Math.min(10, value.length + 1))}em`,
          border: 0,
          borderBottom: '1px solid currentColor',
          background: 'transparent',
          font: 'inherit',
          fontSize: '0.75rem',
          outline: 'none',
        }}
      />
      <datalist id={listId}>
        {filteredOptions.map((entry) => (
          <option
            key={authorityEntryId(field.key as 'dyn' | 'ruler' | 'era', entry)}
            value={entry.label}
          />
        ))}
      </datalist>
    </>
  );
};

const InlineDateField = ({
  field,
  onCommit,
  onToggle,
}: {
  field: ReturnType<typeof dateEditorFields>[number];
  onCommit: (value: string) => void;
  onToggle?: () => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(field.value);

  useEffect(() => setValue(field.value), [field.value]);

  if (!field.editable) {
    return (
      <Typography
        component="span"
        variant="caption"
        sx={{ color: 'text.primary' }}
        title={field.label}
      >
        {field.value || '—'}
      </Typography>
    );
  }

  if (!editing && (field.key === 'intercalary' || field.key === 'lp')) {
    return (
      <Button
        size="small"
        variant="text"
        onClick={(event) => {
          event.stopPropagation();
          onToggle?.();
        }}
        sx={{
          minWidth: 0,
          p: 0,
          color: field.value ? 'warning.main' : 'text.disabled',
          fontSize: '0.75rem',
        }}
        title={field.label}
      >
        {field.value || '—'}
      </Button>
    );
  }

  if (!editing) {
    return (
      <Typography
        component="button"
        type="button"
        variant="caption"
        onClick={(event) => {
          event.stopPropagation();
          setEditing(true);
        }}
        sx={{
          border: 0,
          borderBottom: '1px dashed',
          borderColor: 'warning.main',
          background: 'none',
          color: field.value ? 'warning.dark' : 'text.disabled',
          cursor: 'text',
          p: 0,
          font: 'inherit',
        }}
        title={`Edit ${field.label}`}
      >
        {field.value || '—'}
      </Typography>
    );
  }

  return (
    <input
      autoFocus
      aria-label={field.label}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => {
        onCommit(value);
        setEditing(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onCommit(value);
          setEditing(false);
        }
        if (event.key === 'Escape') setEditing(false);
      }}
      onClick={(event) => event.stopPropagation()}
      style={{
        width: `${Math.max(2, Math.min(8, value.length + 1))}em`,
        border: 0,
        borderBottom: '1px solid currentColor',
        background: 'transparent',
        font: 'inherit',
        fontSize: '0.75rem',
        outline: 'none',
      }}
    />
  );
};

const DateRow = ({
  suggestion,
  isCurrent,
  selectedIndex,
  authority,
  onSelectCandidate,
  onSelect,
  onAccept,
  onReject,
  onUndo,
  onPreview,
  onEditField,
  onEditAuthority,
}: DateRowProps) => {
  const resolution = suggestion.dateResolution;
  const candidates = resolution?.candidates ?? [];
  const dateStatus = resolution?.status ?? 'unique';
  const acceptReady = canAcceptDateSuggestion(suggestion, selectedIndex);
  const editorFields = dateEditorFields(suggestion, selectedIndex, authority);
  const attrs = { ...(suggestion.attributes ?? {}) };
  const authorityOptions = (key: 'dyn' | 'ruler' | 'era') => {
    if (!authority) return [];
    if (key === 'dyn') return authority.dynasties;
    if (key === 'ruler')
      return authority.rulers.filter(
        (entry) => !attrs.dyn_id || String(entry.dynId) === attrs.dyn_id,
      );
    return authority.eras.filter(
      (entry) =>
        (!attrs.dyn_id || String(entry.dynId) === attrs.dyn_id) &&
        (!attrs.ruler_id || entry.rulerId == null || String(entry.rulerId) === attrs.ruler_id),
    );
  };

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
        py: 0.5,
        cursor: 'pointer',
        borderLeft: isCurrent ? '3px solid' : '3px solid transparent',
        borderLeftColor: isCurrent ? 'primary.main' : 'transparent',
        bgcolor:
          suggestion.status === 'accepted'
            ? 'success.50'
            : suggestion.status === 'rejected'
              ? 'action.disabledBackground'
              : isCurrent
                ? 'action.selected'
                : undefined,
        opacity: suggestion.status === 'rejected' ? 0.6 : 1,
      }}
    >
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
        {editorFields.map((field) =>
          isAuthorityKey(field.key) && authority ? (
            <InlineAuthorityField
              key={field.key}
              field={field}
              id={`${suggestion.id}-${field.key}`}
              options={authorityOptions(field.key)}
              onCommit={(entry) => onEditAuthority?.(field.key as 'dyn' | 'ruler' | 'era', entry)}
            />
          ) : (
            <InlineDateField
              key={field.key}
              field={field}
              onCommit={(value) => onEditField?.(field.key, value)}
              onToggle={
                field.key === 'intercalary' || field.key === 'lp'
                  ? () => onEditField?.(field.key)
                  : undefined
              }
            />
          ),
        )}
        {candidates.length > 1 && selectedIndex == null && (
          <Typography
            component="button"
            type="button"
            variant="caption"
            onClick={(event) => {
              event.stopPropagation();
              onSelectCandidate?.(0);
            }}
            sx={{
              border: 0,
              borderBottom: '1px dashed',
              borderColor: 'error.main',
              background: 'none',
              color: 'error.main',
              cursor: 'pointer',
              p: 0,
              font: 'inherit',
            }}
          >
            choose interpretation
          </Typography>
        )}
        {candidates.length > 1 && selectedIndex != null && (
          <Typography
            component="button"
            type="button"
            variant="caption"
            onClick={(event) => {
              event.stopPropagation();
              onSelectCandidate?.((selectedIndex + 1) % candidates.length);
            }}
            sx={{
              border: 0,
              borderBottom: '1px dashed',
              borderColor: 'primary.main',
              background: 'none',
              color: 'primary.main',
              cursor: 'pointer',
              maxWidth: 130,
              overflow: 'hidden',
              p: 0,
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              font: 'inherit',
            }}
            title="Click to try the next interpretation"
          >
            {candidates[selectedIndex]?.displayLine ?? 'interpretation'}
          </Typography>
        )}
        <Chip
          size="small"
          variant="outlined"
          label={dateStatusLabel[dateStatus] ?? dateStatus}
          sx={{ height: 18 }}
        />
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
                {suggestion.status === 'accepted' && onReject ? (
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
                {onUndo ? (
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

      {resolution && suggestion.status === 'pending' && dateStatus === 'unresolved' && (
        <Alert severity="info" sx={{ py: 0.1, mt: 0.25, fontSize: '0.7rem' }}>
          Relative date — confirm a context or exclude it from the calendar stream.
        </Alert>
      )}

      {suggestion.status !== 'pending' && resolution?.selectedCandidateIndex != null && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
          {candidates[resolution.selectedCandidateIndex]?.displayLine}
        </Typography>
      )}
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
  refreshing = false,
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

  const controller = useMemo(
    () => new ReviewController(suggestions, { onFocus, onDecision }),
    [suggestions, onFocus, onDecision],
  );
  const snapshot = controller.snapshot();

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

  // Reclaim focus only if it's already somewhere inside this panel (e.g. on a button
  // that was just clicked) so j/k navigation keeps working after a decision. Never pull
  // focus away from the editor — a pending decision can resolve after the user has already
  // clicked back into the document, and stealing focus there silently breaks editor
  // shortcuts like Shift+Backspace even though the caret still looks active.
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

  /** Resolve pass: once nothing is pending, apply accepted dates (host closes) or close empty. */
  const finishIfIdle = () => {
    if (!finishWhenIdle || controller.pendingVisible().length > 0) return;
    const toApply = collectForApply(false);
    if (toApply.length > 0) onApply(toApply);
    else onClose?.();
  };

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
    finishIfIdle();
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
    [controller, snapshot, suggestions],
  );

  const undecideItem = (suggestion: Suggestion) => {
    controller.undecideSuggestion(suggestion);
    rerender();
  };

  const editDateField = (suggestion: Suggestion, key: DateEditorKey, value?: string) => {
    if (key === 'intercalary' || key === 'lp') toggleDateEditorField(suggestion, key);
    else if (value !== undefined) updateDateEditorField(suggestion, key, value);
    rerender();
  };

  const editDateAuthority = (
    suggestion: Suggestion,
    key: 'dyn' | 'ruler' | 'era',
    entry: DynastyAuthorityEntry | RulerAuthorityEntry | EraAuthorityEntry,
  ) => {
    updateDateAuthorityField(suggestion, key, entry);
    rerender();
  };

  const changeDateDecision = (suggestion: Suggestion, decision: 'accepted' | 'rejected') => {
    if (decision === 'accepted') {
      const selected = selectedIndexFor(suggestion);
      if (!canAcceptDateSuggestion(suggestion, selected)) return;
      finalizeDateSuggestion(suggestion, selected);
      const attach = attachIndexFor(suggestion);
      if (attach !== '' && suggestion.dateResolution) {
        suggestion.dateResolution.attachToDateIndex = attach;
      }
    }
    controller.changeDecision(suggestion, decision);
    rerender();
  };

  const apply = () => {
    onApply(collectForApply(false));
    forceRender();
  };

  const applyAllRemaining = () => {
    onApply(collectForApply(true));
    forceRender();
  };

  const { counts, pendingVisible: pending, current } = snapshot;
  const remainingCount = counts.pending + counts.accepted;

  useEffect(() => {
    if (!current || !listRef.current) return;
    const index = suggestions.indexOf(current);
    if (index >= 0)
      dateListRef.current?.scrollToIndex({ index, align: 'center', behavior: 'auto' });
  }, [current?.id, suggestions]);

  const renderDateRow = (suggestion: Suggestion) => {
    const pendingIndex = pending.indexOf(suggestion);
    return (
      <DateRow
        key={suggestion.id}
        suggestion={suggestion}
        isCurrent={suggestion === current}
        selectedIndex={selectedIndexFor(suggestion)}
        authority={authority}
        onSelectCandidate={(candidateIndex) => {
          setCandidateById((current) => ({ ...current, [suggestion.id]: candidateIndex }));
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
          suggestion.status === 'pending' && pendingIndex >= 0
            ? () => decidePending(pendingIndex, 'accepted')
            : suggestion.status === 'rejected'
              ? () => changeDateDecision(suggestion, 'accepted')
              : undefined
        }
        onReject={
          suggestion.status === 'pending' && pendingIndex >= 0
            ? () => decidePending(pendingIndex, 'rejected')
            : suggestion.status === 'accepted'
              ? () => changeDateDecision(suggestion, 'rejected')
              : undefined
        }
        onUndo={suggestion.status !== 'pending' ? () => undecideItem(suggestion) : undefined}
        onPreview={() => controller.preview(suggestion)}
        onEditField={(key, value) => editDateField(suggestion, key, value)}
        onEditAuthority={(key, entry) => editDateAuthority(suggestion, key, entry)}
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
          {counts.pending} pending · {counts.accepted} accepted · {counts.rejected} rejected
        </Typography>
      </Box>

      <Box
        ref={listRef}
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        onClick={() => containerRef.current?.focus()}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            px: 1,
            py: 0.25,
            color: 'text.secondary',
            fontSize: '0.6rem',
            whiteSpace: 'nowrap',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
          aria-hidden
        >
          <span>era</span>
          <span>ruler</span>
          <span>year</span>
          <span>sex-year</span>
          <span>month</span>
          <span>閏</span>
          <span>day</span>
          <span>干支</span>
          <span>phase</span>
          <span>new-moon</span>
        </Box>
        {suggestions.length > 0 ? (
          <Virtuoso
            ref={dateListRef}
            data={suggestions}
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
        {onRecalculate && (
          <Button
            size="small"
            variant="outlined"
            disabled={busy || refreshing}
            onClick={onRecalculate}
            startIcon={<RefreshIcon fontSize="small" />}
            data-testid="date-curator-recalculate"
          >
            Recalculate
          </Button>
        )}
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
