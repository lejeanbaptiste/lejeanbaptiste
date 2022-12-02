import {
  Box,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { getIcon } from '@src/assets/icons';
import { motion } from 'framer-motion';
import React, { type FC } from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { styled } from '@mui/material/styles';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';

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
    backgroundColor: theme.palette.background.paper, //'#f5f5f9',
    color: theme.palette.text.secondary, //'rgba(0, 0, 0, 0.87)',
    // maxWidth: 250,
    // border: '1px solid #dadde9',
    borderWidth: theme.palette.mode === 'dark' ? 1 : 0,
    borderStyle: 'solid',
    borderColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[300],
    boxShadow: theme.palette.mode === 'dark' ? 0 : `0 0 2px ${theme.palette.grey[400]}`,
  },
}));

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
