import { Box, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip } from '@mui/material';
import { getIcon } from '@src/assets/icons';
import { motion } from 'framer-motion';
import React, { type FC } from 'react';

export interface MenuButtonProps {
  active?: boolean;
  disabled?: boolean;
  disabledTooltipText?: string;
  hide?: boolean;
  icon?: string;
  label: string;
  onClick?: (value: string, title?: string) => void;
  value: string;
}

export const MenuButton: FC<MenuButtonProps> = ({
  active = false,
  disabled,
  disabledTooltipText,
  icon,
  label,
  onClick,
  value,
}) => {
  const Icon = icon ? getIcon(icon) : undefined;

  const handleClick = () => (onClick ? onClick(value, label) : undefined);

  return (
    <Box
      overflow="hidden"
      component={motion.div}
      layout
      initial={{ height: 0 }}
      animate={{ height: 'auto' }}
    >
      <Tooltip placement="right" title={disabled ? disabledTooltipText : ''}>
        <span>
          <ListItem disablePadding>
            <ListItemButton
              disabled={disabled}
              onClick={handleClick}
              selected={active}
              sx={{ py: 0.5, borderTopRightRadius: 8, borderBottomRightRadius: 8 }}
            >
              {Icon && (
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Icon
                    fontSize="small"
                    sx={{ color: active ? ({ palette }) => palette.primary.light : 'inherit' }}
                  />
                </ListItemIcon>
              )}
              <ListItemText
                primary={label}
                sx={{
                  ':first-letter': { textTransform: 'uppercase' },
                  span: { color: ({ palette }) => (active ? palette.primary.light : 'inherit') },
                }}
              />
            </ListItemButton>
          </ListItem>
        </span>
      </Tooltip>
    </Box>
  );
};
