import { Box, Popover, TextField } from '@mui/material';
import { useState } from 'react';
import type { MouseEvent } from 'react';
import type { SxProps, Theme } from '@mui/material';

const PRESET_COLORS = [
  '#ffffff', '#f5f5f5', '#e0e0e0', '#9e9e9e', '#000000',
  '#e8f4fc', '#1a5276', '#eafaf1', '#186a3b', '#fef9e7',
  '#7d6608', '#f4ecf7', '#512e5f', '#fdebd0', '#784212',
  '#ffcdd2', '#f44336', '#c8e6c9', '#4caf50', '#bbdefb',
  '#2196f3', '#fff9c4', '#ffc107', '#e1bee7', '#9c27b0',
];

const isValidHex = (value: string): boolean => /^#[0-9a-f]{6}$/i.test(value.trim());

interface ColorSwatchPickerProps {
  ariaLabel: string;
  disabled?: boolean;
  onChange: (hex: string) => void;
  size?: number;
  swatchColor?: string;
  sx?: SxProps<Theme>;
  value: string;
}

/**
 * Popover-based color picker. Deliberately avoids the native `<input
 * type="color">` OS picker, which on Linux/Electron can render outside the
 * window bounds without clamping to the screen (the same class of bug as
 * MUI's native <select>).
 */
export const ColorSwatchPicker = ({
  ariaLabel,
  disabled,
  onChange,
  size = 18,
  swatchColor,
  sx,
  value,
}: ColorSwatchPickerProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [draftHex, setDraftHex] = useState(value);

  const open = Boolean(anchorEl);

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    if (disabled) return;
    setDraftHex(value);
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const commitHex = (hex: string) => {
    const normalized = hex.trim().startsWith('#') ? hex.trim() : `#${hex.trim()}`;
    if (isValidHex(normalized)) onChange(normalized.toLowerCase());
  };

  return (
    <>
      <Box
        aria-label={ariaLabel}
        component="button"
        disabled={disabled}
        onClick={handleOpen}
        type="button"
        sx={{
          bgcolor: swatchColor ?? 'background.paper',
          border: '1.5px solid',
          borderColor: 'divider',
          borderRadius: 0.75,
          cursor: disabled ? 'default' : 'pointer',
          display: 'block',
          flexShrink: 0,
          height: size,
          p: 0,
          width: size,
          ...sx,
        }}
      />
      <Popover
        anchorEl={anchorEl}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        onClose={handleClose}
        open={open}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
      >
        <Box sx={{ p: 1.5, width: 184 }}>
          <Box
            sx={{
              display: 'grid',
              gap: 0.5,
              gridTemplateColumns: 'repeat(5, 1fr)',
              mb: 1.5,
            }}
          >
            {PRESET_COLORS.map((preset) => (
              <Box
                aria-label={preset}
                component="button"
                key={preset}
                onClick={() => {
                  commitHex(preset);
                  handleClose();
                }}
                type="button"
                sx={{
                  bgcolor: preset,
                  border: '1.5px solid',
                  borderColor:
                    preset.toLowerCase() === value.toLowerCase() ? 'primary.main' : 'divider',
                  borderRadius: 0.5,
                  cursor: 'pointer',
                  height: 24,
                  p: 0,
                  width: 24,
                }}
              />
            ))}
          </Box>
          <TextField
            error={!isValidHex(draftHex)}
            fullWidth
            helperText={isValidHex(draftHex) ? ' ' : 'Format: #rrggbb'}
            label="Hex"
            onBlur={() => commitHex(draftHex)}
            onChange={(event) => setDraftHex(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitHex(draftHex);
            }}
            size="small"
            value={draftHex}
          />
        </Box>
      </Popover>
    </>
  );
};
