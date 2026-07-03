import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import UndoIcon from '@mui/icons-material/Undo';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { handleReviewKey, ReviewController, type DecisionEvent } from './reviewController';
import type { Suggestion } from './types';

export interface ReviewPanelProps {
  suggestions: Suggestion[];
  /** Host applies the accepted suggestions (apply engine + editor undo snapshot). */
  onApply: (accepted: Suggestion[]) => void;
  /** Host jumps the editor to the suggestion, e.g. via utilities.selectElementById. */
  onFocus?: (suggestion: Suggestion) => void;
  /** Feeds the decision log. */
  onDecision?: (event: DecisionEvent) => void;
  /** Host closes the panel. */
  onClose?: () => void;
}

const statusColor: Record<Suggestion['status'], 'default' | 'success' | 'error' | 'warning'> = {
  pending: 'default',
  accepted: 'success',
  rejected: 'error',
  unresolvable: 'warning',
};

/**
 * The shared review walk (Phase 1): one commit gate for every auto-tagging
 * method. Renders the suggestion to-do list; keyboard: j/↓ k/↑ navigate,
 * a/Enter accept, r/x reject, u undecide.
 */
export const ReviewPanel = ({
  suggestions,
  onApply,
  onFocus,
  onDecision,
  onClose,
}: ReviewPanelProps) => {
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const containerRef = useRef<HTMLDivElement>(null);

  const controller = useMemo(
    () => new ReviewController(suggestions, { onFocus, onDecision }),
    // a new batch means a new walk
    [suggestions, onFocus, onDecision],
  );

  // Take keyboard focus when a batch mounts, so j/k/a/r work without a click.
  useEffect(() => {
    containerRef.current?.focus();
  }, [controller]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (handleReviewKey(controller, event.key)) {
        event.preventDefault();
        forceRender();
      }
    },
    [controller],
  );

  const decide = (index: number, decision: 'accepted' | 'rejected') => {
    controller.moveTo(index);
    controller.decide(decision);
    containerRef.current?.focus();
    forceRender();
  };

  const undecide = (index: number) => {
    controller.moveTo(index);
    controller.undecide();
    containerRef.current?.focus();
    forceRender();
  };

  const apply = () => {
    onApply(controller.takeAccepted());
    forceRender();
  };

  const counts = controller.counts();
  const visible = controller.visible();
  const current = controller.current();

  return (
    <Box
      ref={containerRef}
      data-testid="review-panel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', outline: 'none' }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1 }}>
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          Review suggestions
        </Typography>
        <Typography variant="caption" data-testid="review-counts">
          {counts.pending} pending · {counts.accepted} accepted · {counts.rejected} rejected
          {counts.unresolvable > 0 ? ` · ${counts.unresolvable} unresolvable` : ''}
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto' }} role="list">
        {visible.map((suggestion, index) => (
          <Box
            key={suggestion.id}
            role="listitem"
            data-testid={`review-item-${suggestion.id}`}
            data-current={suggestion === current || undefined}
            onClick={() => {
              controller.moveTo(index);
              forceRender();
            }}
            sx={{
              p: 1,
              cursor: 'pointer',
              borderLeft: suggestion === current ? '3px solid' : '3px solid transparent',
              borderLeftColor: suggestion === current ? 'primary.main' : 'transparent',
              bgcolor: suggestion === current ? 'action.selected' : undefined,
            }}
          >
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip size="small" label={`<${suggestion.tag}>`} />
              <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
                {suggestion.anchor.surface}
              </Typography>
              <Chip size="small" variant="outlined" label={suggestion.source} />
              {suggestion.confidence !== undefined && (
                <Chip size="small" variant="outlined" label={suggestion.confidence.toFixed(2)} />
              )}
              <Chip
                size="small"
                color={statusColor[suggestion.status]}
                label={suggestion.status}
                data-testid={`status-${suggestion.id}`}
              />
              {suggestion.status !== 'unresolvable' && (
                <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25 }}>
                  {suggestion.status === 'pending' ? (
                    <>
                      <Tooltip title="Accept (a)">
                        <IconButton
                          size="small"
                          color="success"
                          data-testid={`accept-${suggestion.id}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            decide(index, 'accepted');
                          }}
                        >
                          <CheckIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reject (r)">
                        <IconButton
                          size="small"
                          color="error"
                          data-testid={`reject-${suggestion.id}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            decide(index, 'rejected');
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  ) : (
                    <Tooltip title="Undo (u)">
                      <IconButton
                        size="small"
                        data-testid={`undo-${suggestion.id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          undecide(index);
                        }}
                      >
                        <UndoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" component="div">
              …{suggestion.anchor.contextBefore}
              <b>{suggestion.anchor.surface}</b>
              {suggestion.anchor.contextAfter}…
            </Typography>
            {suggestion.rationale && (
              <Typography variant="caption" component="div">
                {suggestion.rationale}
              </Typography>
            )}
          </Box>
        ))}
        {visible.length === 0 && (
          <Typography variant="body2" sx={{ p: 2 }} color="text.secondary">
            Nothing to review.
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, p: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          size="small"
          variant="contained"
          disabled={counts.accepted === 0}
          onClick={apply}
          data-testid="review-apply"
        >
          Apply {counts.accepted > 0 ? `(${counts.accepted})` : ''}
        </Button>
        {onClose && (
          <Button size="small" onClick={onClose}>
            Close
          </Button>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
          j/k navigate · a accept · r reject · u undo
        </Typography>
      </Box>
    </Box>
  );
};
