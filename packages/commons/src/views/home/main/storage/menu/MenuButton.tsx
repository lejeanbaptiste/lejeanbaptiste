import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Box,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { styled } from '@mui/material/styles';
import Tooltip, { tooltipClasses, TooltipProps } from '@mui/material/Tooltip';
import { getIcon } from '@src/assets/icons';
import { motion } from 'framer-motion';
import React from 'react';

export interface MenuButtonProps {
  active?: boolean;
  disabled?: boolean;
  disabledTooltipText?: string | React.ReactNode;
  hide?: boolean;
  icon?: string;
  label: string;
  onClick?: (value: string, title?: string) => void;
  value: string;
}

const HtmlTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    maxWidth: 220,
    borderWidth: theme.palette.mode === 'dark' ? 1 : 0,
    borderStyle: 'solid',
    borderColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[300],
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.secondary,
    boxShadow: theme.palette.mode === 'dark' ? 0 : `0 0 2px ${theme.palette.grey[400]}`,
  },
}));

export const MenuButton = ({
  active = false,
  disabled,
  disabledTooltipText,
  icon,
  label,
  onClick,
  value,
}: MenuButtonProps) => {
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
      <ListItem
        disablePadding
        secondaryAction={
          disabled &&
          disabledTooltipText && (
            <HtmlTooltip title={disabled ? disabledTooltipText : ''}>
              <span>
                <IconButton aria-label="help" disabled edge="end" size="small">
                  <InfoOutlinedIcon
                    fontSize="small"
                    sx={{ color: active ? ({ palette }) => palette.primary.light : 'inherit' }}
                  />
                </IconButton>
              </span>
            </HtmlTooltip>
          )
        }
      >
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
    </Box>
  );
};
