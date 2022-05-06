import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import {
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { UserType } from '@src/@types/types';
import React, { FC, useState } from 'react';

interface SideButtonProps {
  active?: boolean;
  label: string;
  onClick?: (value: string) => void;
  onDelete?: (value: string) => void;
  type?: UserType;
  value: string;
}

const SideButton: FC<SideButtonProps> = ({
  active = false,
  label,
  onClick,
  onDelete,
  type,
  value,
}) => {
  const [hover, setHover] = useState(false);
  const handleClick = () => (onClick ? onClick(value) : undefined);
  const handleDelete = () => (onDelete ? onDelete(value) : undefined);

  const theme = useTheme();
  const isSM = useMediaQuery(theme.breakpoints.down('sm'));

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
            {type === 'organization' ? (
              <GroupWorkIcon
                fontSize="small"
                sx={{ color: active ? theme.palette.primary.main : 'inherit' }}
              />
            ) : (
              <AccountCircleIcon
                fontSize="small"
                sx={{ color: active ? theme.palette.primary.main : 'inherit' }}
              />
            )}
          </ListItemIcon>
        )}
        <ListItemText
          id={value}
          primary={label}
          sx={{
            span: {
              color: active ? theme.palette.primary.main : 'inherit',
              fontWeight: active ? 600 : 400,
            },
          }}
        />
      </ListItemButton>
    </ListItem>
  );
};

export default SideButton;
