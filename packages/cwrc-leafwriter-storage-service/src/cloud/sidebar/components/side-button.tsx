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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { UserType } from '@src/types';
import { motion, type Variants } from 'framer-motion';
import { useState } from 'react';

interface SideButtonProps {
  active?: boolean;
  label: string;
  onClick?: (value: string) => void;
  onDelete?: (value: string) => void;
  type?: UserType;
  uuid?: string;
  value: string;
}

export const SideButton = ({
  active = false,
  label,
  onClick,
  onDelete,
  type,
  uuid,
  value,
}: SideButtonProps) => {
  const [hover, setHover] = useState(false);
  const handleClick = () => (onClick ? onClick(value) : undefined);
  const handleDelete = () => (onDelete && uuid ? onDelete(uuid) : undefined);

  const theme = useTheme();
  const isSM = useMediaQuery(theme.breakpoints.down('sm'));

  const variation: Variants = {
    show: { height: 'auto', opacity: 1 },
    hide: { height: 0, opacity: 0 },
  };

  return (
    <ListItem
      component={motion.div}
      variants={variation}
      initial={false}
      animate="show"
      exit="hide"
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
      sx={[{ whiteSpace: 'inherit' }, isSM && { whiteSpace: 'nowrap' }]}
      title={label}
    >
      <ListItemButton
        data-testid={`primary-button`}
        alignItems="flex-start"
        autoFocus={active}
        onClick={handleClick}
        selected={active}
        sx={{ py: 0.5, borderRadius: 1 }}
      >
        {type && (
          <ListItemIcon sx={{ minWidth: 28 }}>
            <Icon
              component={type === 'organization' ? GroupWorkIcon : AccountCircleIcon}
              fontSize="small"
              sx={[{ color: 'inherit' }, active && { color: theme.palette.primary.main }]}
            />
          </ListItemIcon>
        )}
        <ListItemText
          id={value}
          primary={label}
          sx={[
            {
              span: {
                color: 'inherit',
                fontWeight: 400,
                '&::first-letter': { textTransform: 'uppercase' },
              },
            },
            active && {
              span: {
                color: theme.palette.primary.main,
                fontWeight: 600,
              },
            },
          ]}
        />
      </ListItemButton>
    </ListItem>
  );
};
