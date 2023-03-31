import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import {
  Icon,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';
import type { UserType } from '../../../types';

interface SideButtonProps {
  active?: boolean;
  label: string;
  onClick?: (value: string) => void;
  onDelete?: (value: string) => void;
  type?: UserType;
  value: string;
}

export const SideButton = ({
  active = false,
  label,
  onClick,
  onDelete,
  type,
  value,
}: SideButtonProps) => {
  const [hover, setHover] = useState(false);
  const handleClick = () => (onClick ? onClick(value) : undefined);
  const handleDelete = () => (onDelete ? onDelete(value) : undefined);

  const { breakpoints, palette } = useTheme();
  const isSM = useMediaQuery(breakpoints.down('sm'));

  return (
    <ListItem
      disablePadding
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      secondaryAction={
        !!onDelete &&
        hover && (
          <IconButton
            aria-label="Remove"
            data-testid={`secondary-button`}
            onClick={handleDelete}
            edge="end"
            size="small"
          >
            <HighlightOffOutlinedIcon fontSize="inherit" />
          </IconButton>
        )
      }
      sx={{ whiteSpace: isSM ? 'nowrap' : 'inherit' }}
      title={label}
    >
      <ListItemButton
        data-testid={`primary-button`}
        alignItems="flex-start"
        autoFocus={active}
        onClick={handleClick}
        selected={active}
        sx={{ py: 0.5, borderTopRightRadius: 8, borderBottomRightRadius: 8 }}
      >
        {type && (
          <ListItemIcon sx={{ minWidth: 28 }}>
            <Icon
              component={type === 'organization' ? GroupWorkIcon : AccountCircleIcon}
              fontSize="small"
              sx={{ color: active ? palette.primary.main : 'inherit' }}
            />
          </ListItemIcon>
        )}
        <ListItemText
          id={value}
          primary={label}
          sx={{
            span: {
              color: active ? palette.primary.main : 'inherit',
              fontWeight: active ? 600 : 400,
              '&::first-letter': { textTransform: 'uppercase' },
            },
          }}
        />
      </ListItemButton>
    </ListItem>
  );
};
