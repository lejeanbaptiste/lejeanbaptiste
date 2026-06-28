import type { NodeDetail } from '@cwrc/leafwriter-validator';
import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useRef } from 'react';
import type { TagCommandMode } from './tagCommand';

export interface TagCommandPopupProps {
  anchor: { left: number; top: number } | null;
  filter: string;
  highlightedIndex: number;
  matchCount: number;
  mode: TagCommandMode;
  onEnterWalkMode: () => void;
  onApplySingle: () => void;
  onApplyTag: (tag: NodeDetail) => void;
  onApplyPropagate: () => void;
  onClose: () => void;
  onFilterChange: (value: string) => void;
  onHighlightChange: (index: number) => void;
  onPopupKeyDown: (event: React.KeyboardEvent) => void;
  open: boolean;
  selectedText: string;
  suggestions: NodeDetail[];
}

export const TagCommandPopup = ({
  anchor,
  filter,
  highlightedIndex,
  matchCount,
  mode,
  onEnterWalkMode,
  onApplySingle,
  onApplyTag,
  onApplyPropagate,
  onClose,
  onFilterChange,
  onHighlightChange,
  onPopupKeyDown,
  open,
  selectedText,
  suggestions,
}: TagCommandPopupProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open || !anchor) return null;

  const modeLabel =
    mode === 'rename'
      ? 'Rename tag'
      : mode === 'insert'
        ? 'Insert tag'
        : mode === 'lineBreak'
          ? 'Line break'
          : 'Wrap selection';

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        left: anchor.left,
        top: anchor.top + 8,
        zIndex: 1400,
        width: 260,
        maxHeight: 320,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          {modeLabel}
          {selectedText ? ` — "${selectedText.length > 40 ? `${selectedText.slice(0, 40)}…` : selectedText}"` : ''}
        </Typography>
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          placeholder="Filter tags…"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          onKeyDown={onPopupKeyDown}
          inputProps={{ autoComplete: 'off', spellCheck: 'false' }}
        />
      </Box>

      <List dense sx={{ overflow: 'auto', flex: 1, py: 0, maxHeight: 160 }}>
        {suggestions.length === 0 ? (
          <ListItemButton disabled sx={{ py: 0.25 }}>
            <ListItemText
              primary="No matching tags"
              secondary={filter.trim() ? 'Choose a valid tag from the schema' : undefined}
              primaryTypographyProps={{ fontSize: '0.75rem' }}
              secondaryTypographyProps={{ fontSize: '0.7rem' }}
            />
          </ListItemButton>
        ) : (
          suggestions.map((tag, index) => (
            <ListItemButton
              key={`${tag.name}-${tag.fullName ?? ''}`}
              selected={index === highlightedIndex}
              disabled={Boolean(tag.invalid)}
              onClick={() => {
                onHighlightChange(index);
                onApplyTag(tag);
              }}
              sx={{ py: 0.25, minHeight: 28 }}
            >
              <ListItemText
                primary={tag.name}
                secondary={tag.invalid ? 'Not valid here' : tag.fullName}
                primaryTypographyProps={{ fontSize: '0.8125rem' }}
                secondaryTypographyProps={{ fontSize: '0.7rem' }}
              />
            </ListItemButton>
          ))
        )}
      </List>

      {mode === 'wrap' || mode === 'rename' ? (
        <Box sx={{ p: 0.75, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            {matchCount} match{matchCount === 1 ? '' : 'es'} in this file
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              variant="contained"
              onClick={onApplySingle}
              sx={{ flex: 1, minWidth: 0, py: 0.25, fontSize: '0.7rem' }}
            >
              Single
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={onApplyPropagate}
              disabled={!selectedText}
              sx={{ flex: 1, minWidth: 0, py: 0.25, fontSize: '0.7rem' }}
            >
              All
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={onEnterWalkMode}
              disabled={!selectedText}
              sx={{ flex: 1, minWidth: 0, py: 0.25, fontSize: '0.7rem' }}
            >
              Walk
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ p: 0.75, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 0.5 }}>
          <Button size="small" variant="contained" onClick={onApplySingle} sx={{ fontSize: '0.75rem' }}>
            Apply
          </Button>
          <Button size="small" onClick={onClose} sx={{ fontSize: '0.75rem' }}>
            Cancel
          </Button>
        </Box>
      )}
    </Paper>
  );
};
