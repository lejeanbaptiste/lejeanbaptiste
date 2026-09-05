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
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { TagCommandMode } from './tagCommand';
import { useClampedPopupPosition } from './clampPopupPosition';
import norbertMiniPng from '../../assets/images/norbert-mini.png';
import type { PluginTagCommandItem } from '../../../../../packages/cwrc-leafwriter/src/plugins/pluginExtensions';

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
  onApplyPluginTagCommand: (item: PluginTagCommandItem) => void;
  onClose: () => void;
  onFilterChange: (value: string) => void;
  onHighlightChange: (index: number) => void;
  onPopupKeyDown: (event: React.KeyboardEvent) => void;
  open: boolean;
  selectedText: string;
  suggestions: NodeDetail[];
  pluginItems: PluginTagCommandItem[];
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
  onApplyPluginTagCommand,
  onClose,
  onFilterChange,
  onHighlightChange,
  onPopupKeyDown,
  open,
  selectedText,
  suggestions,
  pluginItems,
}: TagCommandPopupProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const {
    ref: popupRef,
    left,
    top,
  } = useClampedPopupPosition(anchor, open, [
    filter,
    highlightedIndex,
    mode,
    suggestions.length,
    matchCount,
  ]);

  useLayoutEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  if (!open || !anchor) return null;

  const modeLabel =
    mode === 'rename'
      ? 'Rename tag'
      : mode === 'insert'
        ? 'Insert tag'
        : mode === 'lineBreak'
          ? 'Line break'
          : 'Wrap selection';

  const footerPluginItems =
    mode === 'wrap' && selectedText
      ? pluginItems.filter((item) => {
          // Schema-linked items appear on their tag row above — don't duplicate.
          if (item.schemaTag && suggestions.some((tag) => tag.name === item.schemaTag)) {
            return false;
          }
          const query = filter.trim().toLowerCase();
          return !query || item.label.toLowerCase().includes(query);
        })
      : [];

  return (
    <Paper
      ref={popupRef}
      elevation={8}
      sx={{
        position: 'fixed',
        left,
        top,
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
          {selectedText
            ? ` — "${selectedText.length > 40 ? `${selectedText.slice(0, 40)}…` : selectedText}"`
            : ''}
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
          suggestions.map((tag, index) => {
            const pluginForTag = pluginItems.find((item) => item.schemaTag === tag.name);
            return (
              <ListItemButton
                key={`${tag.name}-${tag.displayLabel ?? tag.fullName ?? ''}`}
                ref={index === highlightedIndex ? selectedItemRef : undefined}
                selected={index === highlightedIndex}
                disabled={Boolean(tag.invalid)}
                onClick={() => {
                  onHighlightChange(index);
                  if (pluginForTag && !tag.invalid) onApplyPluginTagCommand(pluginForTag);
                  else onApplyTag(tag);
                }}
                sx={{ py: 0.25, minHeight: 28 }}
              >
                {pluginForTag?.icon === 'norbert' ? (
                  <Box
                    component="img"
                    src={norbertMiniPng}
                    alt="Norbert"
                    sx={{ width: 16, height: 16, objectFit: 'contain', mr: 0.75, flexShrink: 0 }}
                  />
                ) : null}
                <ListItemText
                  primary={tag.displayLabel ?? tag.name}
                  secondary={
                    tag.invalid ? 'Not valid here' : tag.displayLabel ? tag.name : tag.fullName
                  }
                  primaryTypographyProps={{ fontSize: '0.8125rem' }}
                  secondaryTypographyProps={{ fontSize: '0.7rem' }}
                />
              </ListItemButton>
            );
          })
        )}
      </List>

      {footerPluginItems.length > 0 ? (
        <Box sx={{ borderTop: 1, borderColor: 'divider', py: 0.25 }}>
          {footerPluginItems.map((item) => (
            <ListItemButton
              key={item.id}
              onClick={() => onApplyPluginTagCommand(item)}
              sx={{ py: 0.25, minHeight: 30 }}
            >
              {item.icon === 'norbert' ? (
                <Box
                  component="img"
                  src={norbertMiniPng}
                  alt="Norbert"
                  sx={{ width: 20, height: 20, objectFit: 'contain', mr: 1 }}
                />
              ) : null}
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 600 }}
              />
            </ListItemButton>
          ))}
        </Box>
      ) : null}

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
          <Button
            size="small"
            variant="contained"
            onClick={onApplySingle}
            sx={{ fontSize: '0.75rem' }}
          >
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
