import { Box, Icon, MenuItem, MenuItemProps, Stack, Typography } from '@mui/material';
import { getIcon } from '@src/assets/icons';
import { StyledToolTip } from '@src/components';
import React, { useCallback, useContext } from 'react';
import { CascadingContext } from '.';
import type { ItemType } from './useMenu';
export interface ItemProps extends MenuItemProps {
  data?: { [key: string]: any };
  disabled?: boolean;
  hide?: boolean;
  icon?: string;
  label: string;
  onTrigger?: (data?: any) => void;
  shortcut?: string;
  type?: ItemType;
  tootipText?: string | React.ReactNode;
}

export const Item = ({
  data,
  disabled = false,
  hide = false,
  icon,
  label,
  onClick,
  onTrigger,
  shortcut,
  type = 'menuItem',
  tootipText,
  ...props
}: ItemProps) => {
  const { rootPopupState } = useContext(CascadingContext);
  if (!rootPopupState) throw new Error('must be used inside a CascadingMenu');

  const handleClick = useCallback(
    (event: any) => {
      //@ts-ignore
      rootPopupState.close(event);
      if (onClick) onClick(event);
      // processClick(trigger);
      if (onTrigger) onTrigger(data);
    },
    [rootPopupState, onClick]
  );

  return (
    <StyledToolTip arrow placement="right" title={disabled && tootipText ? tootipText : ''}>
      <span>
        <MenuItem
          {...props}
          disabled={disabled}
          onClick={handleClick}
          sx={{ mx: 0.5, px: 0.75, borderRadius: 1 }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            width="100%"
            gap={1.5}
            mx={0.5}
            my={0.5}
          >
            {/* LEFT ICON */}
            {icon && <Icon component={getIcon(icon)} fontSize="small" />}

            {/* LABEL */}
            <Box sx={{ flexGrow: 1 }}>
              <Typography
                variant="body1"
                sx={{ textTransform: type === 'menuItem' ? 'capitalize' : 'inherit' }}
              >
                {label}
              </Typography>
            </Box>

            {/* RIGHT */}
            {shortcut && (
              <Typography variant="body2" color="GrayText">
                {shortcut}
              </Typography>
            )}
          </Stack>
        </MenuItem>
      </span>
    </StyledToolTip>
  );
};
