import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import UndoIcon from '@mui/icons-material/Undo';
import WarningIcon from '@mui/icons-material/Warning';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
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
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import {
  handleReviewKey,
  ReviewController,
  type DecisionEvent,
  type PendingGroup,
} from './reviewController';
import { SourceBadges } from './SourceBadges';
import type { CustomThingType } from './thingTypePolicy';
import type { Suggestion } from './types';
import { getValidationColor, getConfidenceLabel } from './llmValidationRank';

/** Human label for a thing sub-type id, falling back to the raw id if renamed/deleted. */
const thingTypeLabel = (id: string, customThingTypes?: CustomThingType[]): string =>
  customThingTypes?.find((type) => type.id === id)?.label ?? id;

/** Chip label for a suggestion, showing the thing sub-type when the tag is `rs`. */
const suggestionTagLabel = (
  suggestion: Suggestion,
  customThingTypes?: CustomThingType[],
): string =>
  suggestion.tag === 'rs' && suggestion.attributes?.type
    ? `<rs type="${thingTypeLabel(suggestion.attributes.type, customThingTypes)}">`
    : `<${suggestion.tag}>`;

export interface ReviewPanelProps {
  suggestions: Suggestion[];
  /**
   * Commit a review pass. `accepted` are written to the document; `rejected`
   * are dropped from the queue so the walk can advance (e.g. Norbert stages).
   */
  onApply: (accepted: Suggestion[], rejected?: Suggestion[]) => void;
  onFocus?: (suggestion: Suggestion) => void;
  onDecision?: (event: DecisionEvent) => void;
  onClose?: () => void;
  autoFocus?: boolean;
  busy?: boolean;
  /** When true, show AI validation warnings and pre-selections. */
  aiValidationEnabled?: boolean;
  /** Background AI curate still running (scores stream in). */
  aiCurating?: boolean;
  /** Batches completed / total for the AI curate progress label. */
  aiCurateProgress?: { done: number; total: number } | null;
  /** Reject-below confidence threshold (0–1). */
  curateRejectBelow?: number;
  onCurateRejectBelowChange?: (value: number) => void;
  /**
   * Re-check pending suggestions against the live document (drop ones
   * already tagged or now schema-blocked) and pull in freshly available
   * person-wrapper / noble-title candidates. Omit to hide the button.
   */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Norbert prerequisite stage; list is already stage-filtered and the category control stays locked. */
  mandatoryStage?: 'nobleTitle' | 'personWrapper';
  /** User-defined thing sub-types, for human-readable `<rs type="...">` chip labels and filtering. */
  customThingTypes?: CustomThingType[];
}

const statusColor: Record<Suggestion['status'], 'default' | 'success' | 'error' | 'warning'> = {
  pending: 'default',
  accepted: 'success',
  rejected: 'error',
  unresolvable: 'warning',
};

const sourceBadgeLabel = (suggestion: Suggestion): string => {
  if (suggestion.source === 'authority' && suggestion.sourceDetail) {
    return suggestion.sourceDetail;
  }
  return suggestion.sourceDetail ?? suggestion.source;
};

interface SuggestionRowProps {
  suggestion: Suggestion;
  isCurrent?: boolean;
  onSelect?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onUndo?: () => void;
  onPreview?: () => void;
  customThingTypes?: CustomThingType[];
}

const SuggestionRow = ({
  suggestion,
  isCurrent,
  onSelect,
  onAccept,
  onReject,
  onUndo,
  onPreview,
  customThingTypes,
}: SuggestionRowProps) => {
  const aiValidation = suggestion.aiValidation;
  const showValidation = aiValidation !== undefined;
  const validationColor = getValidationColor(aiValidation?.confidence);
  const confidenceLabel = getConfidenceLabel(aiValidation?.confidence);

  return (
    <Box
      role="listitem"
      data-testid={`review-item-${suggestion.id}`}
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
        <Chip size="small" label={suggestionTagLabel(suggestion, customThingTypes)} />
        {suggestion.action !== 'add' && (
          <Chip size="small" variant="outlined" color="warning" label={suggestion.action} />
        )}
        <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
          {suggestion.anchor.surface}
        </Typography>
        <SourceBadges label={sourceBadgeLabel(suggestion)} />
        {suggestion.confidence !== undefined && (
          <Chip size="small" variant="outlined" label={suggestion.confidence.toFixed(2)} />
        )}
        {showValidation && (
          <Chip
            size="small"
            variant="outlined"
            color={validationColor}
            label={confidenceLabel}
            title={`AI confidence: ${aiValidation?.confidence?.toFixed(2)}`}
          />
        )}
        {aiValidation?.warning && (
          <Tooltip title={aiValidation.warning} arrow>
            <WarningIcon color="error" sx={{ fontSize: 14 }} />
          </Tooltip>
        )}
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
                <Tooltip title="Accept (Enter)">
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
      <Typography variant="caption" color="text.secondary" component="div">
        …{suggestion.anchor.contextBefore}
        <b>{suggestion.anchor.surface}</b>
        {suggestion.anchor.contextAfter}…
      </Typography>
      {suggestion.rationale && suggestion.source !== 'authority' && (
        <Typography variant="caption" component="div" color="text.secondary" sx={{ mt: 0.25 }}>
          {suggestion.rationale}
        </Typography>
      )}
      {aiValidation?.rationale && (
        <Typography variant="caption" component="div" color="error.main" sx={{ mt: 0.25 }}>
          AI: {aiValidation.rationale}
        </Typography>
      )}
    </Box>
  );
};

interface AlternativeGroupRowProps {
  group: PendingGroup;
  isCurrent: boolean;
  onSelectGroup: () => void;
  onSelectAlternative: (suggestion: Suggestion) => void;
  onAccept: () => void;
  onReject: () => void;
  onPreview: (suggestion: Suggestion) => void;
  customThingTypes?: CustomThingType[];
}

/**
 * Several same-span 'add' suggestions with different tags, stacked as one
 * navigation stop. The checkbox on each row picks which tag wins the span;
 * one shared accept/reject decides the whole pair (accept applies the
 * checked alternative and rejects the rest, reject drops all of them).
 */
const AlternativeGroupRow = ({
  group,
  isCurrent,
  onSelectGroup,
  onSelectAlternative,
  onAccept,
  onReject,
  onPreview,
  customThingTypes,
}: AlternativeGroupRowProps) => {
  const first = group.suggestions[0]!;

  // Also find if any suggestion in the group has an AI warning
  const hasAiWarning = group.suggestions.some((s) => s.aiValidation?.warning);

  return (
    <Box
      role="listitem"
      data-testid={`review-group-${first.id}`}
      data-current={isCurrent || undefined}
      onClick={() => {
        onSelectGroup();
        onPreview(group.suggestions[group.selectedIndex] ?? first);
      }}
      sx={{
        p: 1,
        cursor: 'pointer',
        border: '1px dashed',
        borderColor: isCurrent ? 'primary.main' : 'divider',
        borderLeft: '3px solid',
        borderLeftColor: isCurrent ? 'primary.main' : 'divider',
        bgcolor: isCurrent ? 'action.selected' : 'action.hover',
        borderRadius: 0.5,
        m: 0.5,
      }}
    >
      {group.suggestions.map((suggestion, index) => {
        const aiValidation = suggestion.aiValidation;
        const showValidation = aiValidation !== undefined;
        const validationColor = getValidationColor(aiValidation?.confidence);
        const confidenceLabel = getConfidenceLabel(aiValidation?.confidence);
        const isRecommended = aiValidation?.recommended === true;

        return (
          <Box
            key={suggestion.id}
            data-testid={`review-item-${suggestion.id}`}
            sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Checkbox
              size="small"
              checked={index === group.selectedIndex}
              data-testid={`alt-select-${suggestion.id}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectGroup();
                onSelectAlternative(suggestion);
              }}
              sx={{ p: 0.25 }}
            />
            <Chip
              size="small"
              label={suggestionTagLabel(suggestion, customThingTypes)}
              color={isRecommended ? 'primary' : 'default'}
              variant={isRecommended ? 'filled' : 'outlined'}
            />
            <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
              {suggestion.anchor.surface}
            </Typography>
            <SourceBadges label={sourceBadgeLabel(suggestion)} />
            {suggestion.confidence !== undefined && (
              <Chip size="small" variant="outlined" label={suggestion.confidence.toFixed(2)} />
            )}
            {showValidation && (
              <Chip
                size="small"
                variant="outlined"
                color={validationColor}
                label={confidenceLabel}
                title={`AI confidence: ${aiValidation?.confidence?.toFixed(2)}`}
              />
            )}
            {aiValidation?.warning && (
              <Tooltip title={aiValidation.warning} arrow>
                <WarningIcon color="error" sx={{ fontSize: 14 }} />
              </Tooltip>
            )}
            {index === 0 && (
              <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25 }}>
                <Tooltip title="Accept the checked alternative (Enter)">
                  <IconButton
                    size="small"
                    color="success"
                    data-testid={`accept-group-${first.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onAccept();
                    }}
                  >
                    <CheckIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Reject the pair (Backspace)">
                  <IconButton
                    size="small"
                    color="error"
                    data-testid={`reject-group-${first.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onReject();
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
        );
      })}
      {hasAiWarning && (
        <Typography variant="caption" color="error" sx={{ mt: 0.5, pl: 2 }}>
          AI flagged potential issues with some alternatives
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" component="div">
        …{first.anchor.contextBefore}
        <b>{first.anchor.surface}</b>
        {first.anchor.contextAfter}…
      </Typography>
      {first.aiValidation?.rationale && (
        <Typography variant="caption" component="div" color="error.main" sx={{ mt: 0.25, pl: 2 }}>
          AI: {first.aiValidation.rationale}
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
    <Collapse in={open}>{children}</Collapse>
  </Box>
);

export const ReviewPanel = ({
  suggestions,
  onApply,
  onFocus,
  onDecision,
  onClose,
  autoFocus = true,
  busy = false,
  aiValidationEnabled = false,
  aiCurating = false,
  aiCurateProgress = null,
  curateRejectBelow = 0,
  onCurateRejectBelowChange,
  onRefresh,
  refreshing = false,
  mandatoryStage,
  customThingTypes,
}: ReviewPanelProps) => {
  const { t } = useTranslation('LW');
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingListRef = useRef<VirtuosoHandle>(null);
  const autoCommitLock = useRef(false);
  const [acceptedOpen, setAcceptedOpen] = useState(false);
  const [rejectedOpen, setRejectedOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState<string>('');
  const filteredSuggestions = useMemo(() => {
    // Parent usually stage-filters already; keep the same rules here so the
    // locked Norbert dropdown always matches the list the user can act on.
    if (mandatoryStage === 'nobleTitle') {
      return suggestions.filter((suggestion) => suggestion.tag === 'nobleTitle');
    }
    if (mandatoryStage === 'personWrapper') {
      return suggestions.filter(
        (suggestion) =>
          suggestion.tag === 'name' && suggestion.attributes?.type === 'personWrapper',
      );
    }
    return suggestions.filter((suggestion) => {
      if (!tagFilter) return true;
      if (tagFilter.startsWith('rs::')) {
        return suggestion.tag === 'rs' && suggestion.attributes?.type === tagFilter.slice(4);
      }
      if (tagFilter === 'rs') {
        return suggestion.tag === 'rs' && !suggestion.attributes?.type;
      }
      return suggestion.tag === tagFilter;
    });
  }, [suggestions, tagFilter, mandatoryStage]);

  const controller = useMemo(
    () => new ReviewController(filteredSuggestions, { onFocus, onDecision }),
    [filteredSuggestions, onFocus, onDecision],
  );

  // Parent replaced the batch — allow another idle auto-commit.
  useEffect(() => {
    autoCommitLock.current = false;
  }, [filteredSuggestions]);

  // Re-apply reject-below whenever the threshold or AI scores change.
  useEffect(() => {
    if (!aiValidationEnabled) return;
    controller.applyCurateRejectBelow(curateRejectBelow);
    forceRender();
  }, [aiValidationEnabled, curateRejectBelow, suggestions, controller]);

  const tagOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    let sawUntypedRs = false;
    for (const suggestion of suggestions) {
      if (suggestion.tag === 'rs') {
        const subtype = suggestion.attributes?.type;
        if (subtype) {
          const value = `rs::${subtype}`;
          if (!seen.has(value)) {
            seen.add(value);
            options.push({
              value,
              label: `<rs type="${thingTypeLabel(subtype, customThingTypes)}">`,
            });
          }
        } else {
          sawUntypedRs = true;
        }
        continue;
      }
      if (!seen.has(suggestion.tag)) {
        seen.add(suggestion.tag);
        options.push({ value: suggestion.tag, label: `<${suggestion.tag}>` });
      }
    }
    if (sawUntypedRs) options.push({ value: 'rs', label: '<rs>' });
    return options;
  }, [suggestions, customThingTypes]);
  const snapshot = controller.snapshot();

  useEffect(() => {
    if (autoFocus) containerRef.current?.focus();
  }, [controller, autoFocus]);

  // Reclaim focus only if it's already somewhere inside this panel (e.g. on a button
  // that was just clicked) so j/k navigation keeps working after a decision. Never pull
  // focus away from the editor — a pending decision (accept/reject) can resolve after the
  // user has already clicked back into the document, and stealing focus there silently
  // breaks editor shortcuts like Shift+Backspace even though the caret still looks active.
  const rerender = () => {
    const active = document.activeElement;
    if (active && containerRef.current?.contains(active)) {
      containerRef.current.focus();
    }
    forceRender();
  };

  /** Apply accepted tags and drop rejected ones once every visible row is judged. */
  const finishIfIdle = () => {
    if (busy || autoCommitLock.current) return;
    if (controller.pendingGroups().length > 0) return;
    const judged = controller.takeJudged();
    if (judged.accepted.length === 0 && judged.rejected.length === 0) return;
    autoCommitLock.current = true;
    onApply(judged.accepted, judged.rejected);
    forceRender();
  };

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (handleReviewKey(controller, event.key, { shift: event.shiftKey })) {
        event.preventDefault();
        rerender();
        finishIfIdle();
      }
    },
    // finishIfIdle closes over controller/busy — intentional per keypress
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controller, busy],
  );

  const decidePending = (index: number, decision: 'accepted' | 'rejected') => {
    controller.moveToPendingIndex(index);
    controller.decide(decision);
    rerender();
    finishIfIdle();
  };

  const undecideItem = (suggestion: Suggestion) => {
    controller.undecideSuggestion(suggestion);
    autoCommitLock.current = false;
    rerender();
  };

  const changeDecision = (suggestion: Suggestion, decision: 'accepted' | 'rejected') => {
    controller.changeDecision(suggestion, decision);
    rerender();
    finishIfIdle();
  };

  const selectAlternative = (suggestion: Suggestion) => {
    controller.selectAlternative(suggestion);
    forceRender();
  };

  const apply = () => {
    // Partial apply while items remain pending: keep rejected for undo.
    // Once nothing is pending, dismiss rejected too so the queue can advance.
    if (controller.pendingGroups().length === 0) {
      const judged = controller.takeJudged();
      onApply(judged.accepted, judged.rejected);
    } else {
      onApply(controller.takeAccepted(), []);
    }
    forceRender();
  };

  const applyAllRemaining = () => {
    // takeAllExceptRejected already removes accepted from the walk.
    const accepted = controller.takeAllExceptRejected();
    const rejected = controller.takeRejected();
    onApply(accepted, rejected);
    forceRender();
  };

  const {
    counts,
    pendingGroups,
    acceptedVisible: accepted,
    rejectedVisible: rejected,
    current,
    remainingCount,
  } = snapshot;
  const currentPendingIndex = current
    ? pendingGroups.findIndex((group) => group.suggestions.includes(current))
    : -1;

  useEffect(() => {
    if (snapshot.pendingGroups.length === 0) {
      if (accepted.length > 0) setAcceptedOpen(true);
      if (rejected.length > 0) setRejectedOpen(true);
    }
  }, [snapshot.pendingGroups.length, accepted.length, rejected.length]);

  useEffect(() => {
    if (!current) return;

    if (currentPendingIndex >= 0) {
      pendingListRef.current?.scrollIntoView({
        index: currentPendingIndex,
        align: 'center',
        behavior: 'auto',
      });
      return;
    }

    if (!listRef.current) return;
    listRef.current
      .querySelector(`[data-testid="review-item-${current.id}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
    // Keyed to the current item's id rather than the object: the effect only
    // uses `current.id` to find the row to scroll to, so a same-id replacement
    // would scroll to the same place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, currentPendingIndex]);

  return (
    <Box
      ref={containerRef}
      data-testid="review-panel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', outline: 'none' }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1, flexShrink: 0 }}>
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          Review suggestions
        </Typography>
        <Typography variant="caption" data-testid="review-counts">
          {counts.pending} pending · {counts.accepted} accepted · {counts.rejected} rejected
          {counts.unresolvable > 0 ? ` · ${counts.unresolvable} unresolvable` : ''}
        </Typography>
        {onRefresh && (
          <Tooltip
            title={t('Re-check against the document and regenerate person wrappers / noble titles')}
          >
            <span>
              <IconButton
                size="small"
                onClick={onRefresh}
                disabled={busy || refreshing}
                data-testid="review-refresh"
                aria-label={t('Refresh suggestions')}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>

      {mandatoryStage && (
        <Typography variant="caption" color="warning.main" sx={{ px: 1, pb: 0.5 }}>
          Norbert prerequisite: review all{' '}
          {mandatoryStage === 'nobleTitle' ? 'noble-title' : 'person-wrapper'} suggestions shown
          below before continuing to other tags.
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', px: 1, pb: 0.5, flexShrink: 0 }}>
        <Select
          size="small"
          value={
            mandatoryStage === 'nobleTitle'
              ? 'nobleTitle'
              : mandatoryStage === 'personWrapper'
                ? 'personWrapper'
                : tagFilter
          }
          displayEmpty
          onChange={(event) => setTagFilter(event.target.value)}
          disabled={mandatoryStage !== undefined}
          sx={{ flex: 1, fontSize: 12 }}
        >
          {mandatoryStage === 'nobleTitle' && <MenuItem value="nobleTitle">nobleTitle</MenuItem>}
          {mandatoryStage === 'personWrapper' && (
            <MenuItem value="personWrapper">personWrapper</MenuItem>
          )}
          {!mandatoryStage && <MenuItem value="">All tags</MenuItem>}
          {!mandatoryStage &&
            tagOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
        </Select>
      </Box>

      {aiValidationEnabled && (
        <Box sx={{ px: 1, pb: 0.75, flexShrink: 0 }}>
          {aiCurating && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 0.25 }}
            >
              AI curating
              {aiCurateProgress && aiCurateProgress.total > 0
                ? `… ${aiCurateProgress.done}/${aiCurateProgress.total} batches`
                : '…'}{' '}
              — you can review scored items now
            </Typography>
          )}
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              Reject below
            </Typography>
            <Slider
              size="small"
              min={0}
              max={100}
              step={5}
              value={Math.round(curateRejectBelow * 100)}
              onChange={(_event, value) =>
                onCurateRejectBelowChange?.(Math.max(0, Math.min(1, (value as number) / 100)))
              }
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}%`}
              disabled={!onCurateRejectBelowChange}
              sx={{ flex: 1, minWidth: 0 }}
              aria-label="Reject suggestions below AI confidence"
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flexShrink: 0, width: 32, textAlign: 'right' }}
            >
              {Math.round(curateRejectBelow * 100)}%
            </Typography>
          </Stack>
        </Box>
      )}

      <Box
        ref={listRef}
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        onClick={() => containerRef.current?.focus()}
      >
        {pendingGroups.length > 0 ? (
          <Box role="list" sx={{ flexGrow: 1, minHeight: 0 }}>
            <Virtuoso
              ref={pendingListRef}
              data={pendingGroups}
              overscan={600}
              itemContent={(index, group) =>
                group.suggestions.length > 1 ? (
                  <AlternativeGroupRow
                    key={group.suggestions[0]!.id}
                    group={group}
                    isCurrent={!!current && group.suggestions.includes(current)}
                    onSelectGroup={() => {
                      controller.moveToPendingIndex(index);
                      forceRender();
                    }}
                    onSelectAlternative={selectAlternative}
                    onAccept={() => decidePending(index, 'accepted')}
                    onReject={() => decidePending(index, 'rejected')}
                    onPreview={(suggestion) => controller.preview(suggestion)}
                    customThingTypes={customThingTypes}
                  />
                ) : (
                  <SuggestionRow
                    key={group.suggestions[0]!.id}
                    suggestion={group.suggestions[0]!}
                    isCurrent={group.suggestions[0] === current}
                    onSelect={() => {
                      controller.moveToPendingIndex(index);
                      forceRender();
                    }}
                    onAccept={() => decidePending(index, 'accepted')}
                    onReject={() => decidePending(index, 'rejected')}
                    onPreview={() => controller.preview(group.suggestions[0]!)}
                    customThingTypes={customThingTypes}
                  />
                )
              }
              style={{ height: '100%' }}
            />
          </Box>
        ) : accepted.length === 0 && rejected.length === 0 ? (
          <Typography variant="body2" sx={{ p: 2 }} color="text.secondary">
            Nothing to review.
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ p: 2 }} color="text.secondary">
            No pending items — committing decisions…
          </Typography>
        )}

        {accepted.length > 0 && (
          <DecisionGroup
            title={t('Accepted')}
            count={accepted.length}
            open={acceptedOpen}
            onToggle={() => setAcceptedOpen((open) => !open)}
          >
            {accepted.map((suggestion) => (
              <SuggestionRow
                key={suggestion.id}
                suggestion={suggestion}
                onPreview={() => controller.preview(suggestion)}
                onReject={() => changeDecision(suggestion, 'rejected')}
                onUndo={() => undecideItem(suggestion)}
                customThingTypes={customThingTypes}
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
              <SuggestionRow
                key={suggestion.id}
                suggestion={suggestion}
                onPreview={() => controller.preview(suggestion)}
                onAccept={() => changeDecision(suggestion, 'accepted')}
                onUndo={() => undecideItem(suggestion)}
                customThingTypes={customThingTypes}
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
          data-testid="review-apply-all"
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
          data-testid="review-apply"
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
          j/k · Space pick alternative · Enter · Shift+Enter all same · Backspace · Shift+Backspace
          all same
        </Typography>
      </Box>
    </Box>
  );
};
