import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import UndoIcon from '@mui/icons-material/Undo';
import WarningIcon from '@mui/icons-material/Warning';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  handleReviewKey,
  ReviewController,
  type DecisionEvent,
  type PendingGroup,
} from './reviewController';
import type { Suggestion } from './types';
import { getValidationColor, getConfidenceLabel } from './llmValidationRank';

export interface ReviewPanelProps {
  suggestions: Suggestion[];
  onApply: (accepted: Suggestion[]) => void;
  onFocus?: (suggestion: Suggestion) => void;
  onDecision?: (event: DecisionEvent) => void;
  onClose?: () => void;
  autoFocus?: boolean;
  busy?: boolean;
  /** When true, show AI validation warnings and pre-selections. */
  aiValidationEnabled?: boolean;
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
}

const SuggestionRow = ({
  suggestion,
  isCurrent,
  onSelect,
  onAccept,
  onReject,
  onUndo,
  onPreview,
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
        <Chip size="small" label={`<${suggestion.tag}>`} />
        {suggestion.action !== 'add' && (
          <Chip size="small" variant="outlined" color="warning" label={suggestion.action} />
        )}
        <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
          {suggestion.anchor.surface}
        </Typography>
        <Chip size="small" variant="outlined" label={sourceBadgeLabel(suggestion)} />
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
}

interface AlternativeGroupRowProps {
  group: PendingGroup;
  isCurrent: boolean;
  onSelectGroup: () => void;
  onSelectAlternative: (suggestion: Suggestion) => void;
  onAccept: () => void;
  onReject: () => void;
  onPreview: (suggestion: Suggestion) => void;
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
}: AlternativeGroupRowProps) => {
  const first = group.suggestions[0]!;
  
  // Check if AI has pre-selected a candidate for this group
  // Find the AI preferred tag from any suggestion in the group
  const preferredTag = group.suggestions.find(s => s.aiValidation?.preferredTag)?.aiValidation?.preferredTag;
  const recommendedIndex = preferredTag 
    ? group.suggestions.findIndex(s => s.tag === preferredTag)
    : -1;
  
  // Also find if any suggestion in the group has an AI warning
  const hasAiWarning = group.suggestions.some(s => s.aiValidation?.warning);
  
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
        const isRecommended = aiValidation?.recommended || index === recommendedIndex;
        
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
              label={`<${suggestion.tag}>`} 
              color={isRecommended ? 'primary' : 'default'}
              variant={isRecommended ? 'filled' : 'outlined'}
            />
            {recommendedIndex === index && (
              <Chip size="small" color="primary" label="AI pick" />
            )}
            <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
              {suggestion.anchor.surface}
            </Typography>
            <Chip size="small" variant="outlined" label={sourceBadgeLabel(suggestion)} />
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
        <ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : undefined, transition: '0.2s' }} />
      }
      sx={{ justifyContent: 'space-between', textTransform: 'none', px: 1, py: 0.5, borderRadius: 0 }}
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
}: ReviewPanelProps) => {
  const { t } = useTranslation('LW');
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [acceptedOpen, setAcceptedOpen] = useState(false);
  const [rejectedOpen, setRejectedOpen] = useState(false);

  const controller = useMemo(
    () => new ReviewController(suggestions, { onFocus, onDecision }),
    [suggestions, onFocus, onDecision],
  );

  useEffect(() => {
    if (autoFocus) containerRef.current?.focus();
  }, [controller, autoFocus]);

  const rerender = () => {
    containerRef.current?.focus();
    forceRender();
  };

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (handleReviewKey(controller, event.key, { shift: event.shiftKey })) {
        event.preventDefault();
        forceRender();
      }
    },
    [controller],
  );

  const decidePending = (index: number, decision: 'accepted' | 'rejected') => {
    controller.moveToPendingIndex(index);
    controller.decide(decision);
    rerender();
  };

  const undecideItem = (suggestion: Suggestion) => {
    controller.undecideSuggestion(suggestion);
    rerender();
  };

  const changeDecision = (suggestion: Suggestion, decision: 'accepted' | 'rejected') => {
    controller.changeDecision(suggestion, decision);
    rerender();
  };

  const selectAlternative = (suggestion: Suggestion) => {
    controller.selectAlternative(suggestion);
    forceRender();
  };

  const apply = () => {
    onApply(controller.takeAccepted());
    forceRender();
  };

  const applyAllRemaining = () => {
    onApply(controller.takeAllExceptRejected());
    forceRender();
  };

  const counts = controller.counts();
  const pendingGroups = controller.pendingGroups();
  const accepted = controller.acceptedVisible();
  const rejected = controller.rejectedVisible();
  const current = controller.current();
  const remainingCount = counts.pending + counts.accepted;

  useEffect(() => {
    if (pendingGroups.length === 0) {
      if (accepted.length > 0) setAcceptedOpen(true);
      if (rejected.length > 0) setRejectedOpen(true);
    }
  }, [pendingGroups.length, accepted.length, rejected.length]);

  useEffect(() => {
    if (!current || !listRef.current) return;
    listRef.current
      .querySelector(`[data-testid="review-item-${current.id}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [current?.id]);

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
      </Box>

      <Box
        ref={listRef}
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
        onClick={() => containerRef.current?.focus()}
      >
        <Box role="list" sx={{ flexGrow: 1 }}>
          {pendingGroups.map((group, index) =>
            group.suggestions.length > 1 ? (
              <AlternativeGroupRow
                key={group.suggestions[0]!.id}
                group={group}
                isCurrent={group.suggestions.includes(current!)}
                onSelectGroup={() => {
                  controller.moveToPendingIndex(index);
                  forceRender();
                }}
                onSelectAlternative={selectAlternative}
                onAccept={() => decidePending(index, 'accepted')}
                onReject={() => decidePending(index, 'rejected')}
                onPreview={(suggestion) => controller.preview(suggestion)}
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
              />
            ),
          )}
          {pendingGroups.length === 0 && accepted.length === 0 && rejected.length === 0 && (
            <Typography variant="body2" sx={{ p: 2 }} color="text.secondary">
              Nothing to review.
            </Typography>
          )}
          {pendingGroups.length === 0 && (accepted.length > 0 || rejected.length > 0) && (
            <Typography variant="body2" sx={{ p: 2 }} color="text.secondary">
              No pending items — apply tags or expand groups below to review decisions.
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
              <SuggestionRow
                key={suggestion.id}
                suggestion={suggestion}
                onPreview={() => controller.preview(suggestion)}
                onReject={() => changeDecision(suggestion, 'rejected')}
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
              <SuggestionRow
                key={suggestion.id}
                suggestion={suggestion}
                onPreview={() => controller.preview(suggestion)}
                onAccept={() => changeDecision(suggestion, 'accepted')}
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
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
          j/k · Space pick alternative · Enter · Shift+Enter all same · Backspace · Shift+Backspace all same
        </Typography>
      </Box>
    </Box>
  );
};
