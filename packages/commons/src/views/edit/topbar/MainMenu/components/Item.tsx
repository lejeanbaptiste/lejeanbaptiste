import { Box, MenuItem, MenuItemProps } from '@mui/material';
import { StyledToolTip } from '@src/components';
import type { IconName } from '@src/icons';
import { motion, type Variants } from 'framer-motion';
import React, { MouseEvent, useCallback, useContext } from 'react';
import { CascadingContext } from '../';
import type { ItemType } from '../useMenu';
import { Content } from './Content';

export interface ItemProps<D = {}> extends MenuItemProps {
  data?: D;
  hide?: boolean;
  icon?: IconName;
  label: string;
  onTrigger?: (data?: any) => void;
  shortcut?: string;
  type?: ItemType;
  tooltipText?: string | React.ReactNode;
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
  tooltipText,
  sx,
  ...props
}: ItemProps) => {
  const { rootPopupState } = useContext(CascadingContext);
  if (!rootPopupState) throw new Error('must be used inside a CascadingMenu');

  const handleClick = useCallback(
    (event: MouseEvent<HTMLLIElement, globalThis.MouseEvent>) => {
      rootPopupState.close();

      if (onClick) onClick(event);
      if (onTrigger) onTrigger(data);
    },
    [rootPopupState, onClick]
  );

  const variants: Variants = {
    visible: { height: 'auto', opacity: 1 },
    hidden: { height: 0, opacity: 0 },
  };

  return (
    <Box
      component={motion.div}
      variants={variants}
      initial={false}
      animate="visible"
      exit="hidden"
      transition={{ type: 'tween' }}
      overflow="hidden"
    >
      <StyledToolTip arrow placement="right" title={disabled && tooltipText ? tooltipText : ''}>
        <span>
          <MenuItem
            {...props}
            dense
            disabled={disabled}
            onClick={(event) => handleClick(event)}
            sx={{ justifyContent: 'space-between', mx: 0.5, px: 0.75, gap: 1.5, borderRadius: 1 }}
          >
            <Content {...{ icon, shortcut, sx }}>{label}</Content>
          </MenuItem>
        </span>
      </StyledToolTip>
    </Box>
  );
};
