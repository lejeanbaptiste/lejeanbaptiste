import type { SelectProps } from '@mui/material/Select';

/** Service-record avatar Select menus: always open downward and scroll when long. */
export const avatarSelectMenuProps = {
  anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
  transformOrigin: { vertical: 'top', horizontal: 'left' },
  PaperProps: {
    sx: { maxHeight: 280, overflowY: 'auto' },
  },
  MenuListProps: {
    sx: { maxHeight: 280, overflowY: 'auto', py: 0 },
  },
  slotProps: {
    paper: {
      sx: { maxHeight: 280, overflowY: 'auto' },
    },
    root: {
      slotProps: {
        popper: {
          modifiers: [{ name: 'flip', enabled: false }],
        },
      },
    },
  },
} as NonNullable<SelectProps['MenuProps']>;
