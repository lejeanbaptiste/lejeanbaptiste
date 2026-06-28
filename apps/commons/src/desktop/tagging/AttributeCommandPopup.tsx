import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useRef } from 'react';
import type { SchemaAttributeDetail } from './attributeSuggestions';

export interface AttributeCommandPopupProps {
  anchor: { left: number; top: number } | null;
  focusedField: 'name' | 'value';
  highlightedIndex: number;
  nameFilter: string;
  onClose: () => void;
  onFocusedFieldChange: (field: 'name' | 'value') => void;
  onHighlightChange: (index: number) => void;
  onNameFilterChange: (value: string) => void;
  onPopupKeyDown: (event: React.KeyboardEvent) => void;
  onValueFilterChange: (value: string) => void;
  open: boolean;
  schemaAttributes: SchemaAttributeDetail[];
  tagName: string;
  valueFilter: string;
  valueSuggestions: string[];
}

export const AttributeCommandPopup = ({
  anchor,
  focusedField,
  highlightedIndex,
  nameFilter,
  onClose,
  onFocusedFieldChange,
  onHighlightChange,
  onNameFilterChange,
  onPopupKeyDown,
  onValueFilterChange,
  open,
  schemaAttributes,
  tagName,
  valueFilter,
  valueSuggestions,
}: AttributeCommandPopupProps) => {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      if (focusedField === 'value') {
        valueInputRef.current?.focus();
      } else {
        nameInputRef.current?.focus();
      }
    });
  }, [focusedField, open]);

  if (!open || !anchor) return null;

  const visibleValues = valueSuggestions.filter((value) =>
    value.toLowerCase().includes(valueFilter.trim().toLowerCase()),
  );

  return (
    <Paper
      elevation={8}
      onKeyDown={onPopupKeyDown}
      sx={{
        position: 'fixed',
        left: anchor.left,
        top: anchor.top + 8,
        zIndex: 1400,
        width: 280,
        maxHeight: 360,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
        <Typography variant="subtitle2">Add attribute</Typography>
        <Typography variant="caption" color="text.secondary">
          on &lt;{tagName}&gt; — Tab for value, Enter to commit
        </Typography>
      </Box>

      <Box sx={{ px: 1.5, pb: 1 }}>
        <TextField
          inputRef={nameInputRef}
          fullWidth
          size="small"
          label="Attribute name"
          placeholder="Filter attributes..."
          value={nameFilter}
          onChange={(event) => onNameFilterChange(event.target.value)}
          onFocus={() => onFocusedFieldChange('name')}
          autoComplete="off"
        />
        <TextField
          inputRef={valueInputRef}
          fullWidth
          size="small"
          label="Value"
          placeholder="Attribute value"
          value={valueFilter}
          onChange={(event) => onValueFilterChange(event.target.value)}
          onFocus={() => onFocusedFieldChange('value')}
          sx={{ mt: 1 }}
          autoComplete="off"
        />
      </Box>

      {focusedField === 'name' && schemaAttributes.length > 0 ? (
        <List dense sx={{ flex: 1, overflow: 'auto', py: 0 }}>
          {schemaAttributes.map((attr, index) => (
            <ListItemButton
              key={attr.name}
              disabled={Boolean(attr.invalid)}
              selected={index === highlightedIndex}
              onClick={() => {
                if (attr.invalid) return;
                onNameFilterChange(attr.name);
                onHighlightChange(index);
                onFocusedFieldChange('value');
              }}
            >
              <ListItemText
                primary={attr.name}
                secondary={
                  attr.invalid
                    ? 'Not valid here'
                    : attr.fullName && attr.fullName !== attr.name
                      ? attr.fullName
                      : undefined
                }
              />
            </ListItemButton>
          ))}
        </List>
      ) : null}

      {focusedField === 'value' && visibleValues.length > 0 ? (
        <List dense sx={{ flex: 1, overflow: 'auto', py: 0 }}>
          {visibleValues.map((value, index) => (
            <ListItemButton
              key={value}
              selected={index === highlightedIndex}
              onClick={() => onValueFilterChange(value)}
            >
              <ListItemText primary={value} />
            </ListItemButton>
          ))}
        </List>
      ) : null}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, p: 1.5, pt: 0 }}>
        <Typography
          component="button"
          type="button"
          variant="caption"
          onClick={onClose}
          sx={{ border: 0, background: 'none', cursor: 'pointer', color: 'text.secondary' }}
        >
          Cancel (Esc)
        </Typography>
      </Box>
    </Paper>
  );
};
