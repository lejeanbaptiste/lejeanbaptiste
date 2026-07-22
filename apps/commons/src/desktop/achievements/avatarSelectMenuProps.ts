import type { SelectProps } from '@mui/material/Select';

const menuFontSize = '0.6875rem'; // 11px — compact list, two steps below default body text

/** Service-record avatar Select menus: open downward, scroll when long, no dimming overlay. */
export const avatarSelectMenuProps = {
  anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
  transformOrigin: { vertical: 'top', horizontal: 'left' },
  disableScrollLock: true,
  hideBackdrop: true,
  PaperProps: {
    sx: { maxHeight: 280, overflowY: 'auto', pointerEvents: 'auto' },
  },
  MenuListProps: {
    dense: true,
    sx: {
      maxHeight: 280,
      overflowY: 'auto',
      py: 0,
      fontSize: menuFontSize,
      '& .MuiMenuItem-root': {
        fontSize: menuFontSize,
        minHeight: 28,
        py: 0.375,
      },
    },
  },
  slotProps: {
    paper: {
      sx: { maxHeight: 280, overflowY: 'auto', pointerEvents: 'auto' },
    },
    backdrop: {
      invisible: true,
      sx: { display: 'none', opacity: 0, backgroundColor: 'transparent' },
    },
    root: {
      // Popover/Modal root covers the viewport for positioning; keep it invisible
      // and non-blocking so the service record stays fully visible.
      sx: {
        pointerEvents: 'none',
        backgroundColor: 'transparent',
        '& .MuiBackdrop-root': {
          display: 'none',
          opacity: 0,
          backgroundColor: 'transparent',
        },
      },
    },
  },
} as NonNullable<SelectProps['MenuProps']>;
