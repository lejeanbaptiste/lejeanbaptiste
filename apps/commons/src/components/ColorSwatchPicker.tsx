import { Box, Popover, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import type { SxProps, Theme } from '@mui/material';
import {
  hexToHsl,
  hslToHex,
  hueGradientCss,
  lightnessGradientCss,
} from './colorUtils';

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
 * Popover-based color picker with hue/lightness sliders (stays inside the app
 * window). Avoids the native `<input type="color">` OS picker, which on
 * Linux/Electron can render outside the window bounds.
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
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [lightness, setLightness] = useState(50);

  const open = Boolean(anchorEl);

  const syncSlidersFromHex = (hex: string) => {
    const [nextHue, nextSaturation, nextLightness] = hexToHsl(hex);
    setHue(nextHue);
    setSaturation(nextSaturation);
    setLightness(nextLightness);
  };

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    if (disabled) return;
    setDraftHex(value);
    syncSlidersFromHex(value);
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const commitHex = (hex: string) => {
    const normalized = hex.trim().startsWith('#') ? hex.trim() : `#${hex.trim()}`;
    if (isValidHex(normalized)) {
      const lower = normalized.toLowerCase();
      onChange(lower);
      setDraftHex(lower);
      syncSlidersFromHex(lower);
    }
  };

  const commitHsl = (nextHue: number, nextSaturation: number, nextLightness: number) => {
    const hex = hslToHex(nextHue, nextSaturation, nextLightness);
    setHue(nextHue);
    setSaturation(nextSaturation);
    setLightness(nextLightness);
    setDraftHex(hex);
    onChange(hex);
  };

  useEffect(() => {
    if (!open) setDraftHex(value);
  }, [open, value]);

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
        <Box sx={{ p: 1.5, width: 220 }}>
          <Box
            sx={{
              bgcolor: draftHex,
              border: '1.5px solid',
              borderColor: 'divider',
              borderRadius: 1,
              height: 28,
              mb: 1.5,
            }}
          />
          <Typography color="text.secondary" sx={{ mb: 0.5 }} variant="caption">
            Hue
          </Typography>
          <Box
            component="input"
            aria-label={`${ariaLabel} hue`}
            max={360}
            min={0}
            onChange={(event) =>
              commitHsl(Number(event.target.value), saturation, lightness)
            }
            step={1}
            sx={{
              appearance: 'none',
              background: hueGradientCss(lightness),
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 999,
              cursor: 'pointer',
              display: 'block',
              height: 14,
              mb: 1.25,
              width: '100%',
            }}
            type="range"
            value={Math.round(hue)}
          />
          <Typography color="text.secondary" sx={{ mb: 0.5 }} variant="caption">
            Lightness
          </Typography>
          <Box
            component="input"
            aria-label={`${ariaLabel} lightness`}
            max={100}
            min={0}
            onChange={(event) => commitHsl(hue, saturation, Number(event.target.value))}
            step={1}
            sx={{
              appearance: 'none',
              background: lightnessGradientCss(hue, saturation),
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 999,
              cursor: 'pointer',
              display: 'block',
              height: 14,
              mb: 1.5,
              width: '100%',
            }}
            type="range"
            value={Math.round(lightness)}
          />
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
