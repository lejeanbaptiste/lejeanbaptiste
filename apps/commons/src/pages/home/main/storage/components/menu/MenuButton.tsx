import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Box,
  Icon,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  styled,
  useTheme,
} from '@mui/material';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import { getIcon, type IconName } from '@src/icons';
import { motion } from 'framer-motion';

export interface MenuButtonProps {
  active?: boolean;
  disabled?: boolean;
  disabledTooltipText?: string | React.ReactNode;
  hide?: boolean;
  icon?: IconName;
  label: string;
  onClick: () => void;
  value: string;
}

export const StyledTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    maxWidth: 220,
    boxShadow: theme.palette.mode === 'dark' ? 'none' : `0 0 2px ${theme.palette.grey[300]}`,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.secondary,
  },
}));

export const MenuButton = ({
  active = false,
  disabled,
  disabledTooltipText,
  icon,
  label,
  onClick,
}: MenuButtonProps) => {
  const { palette } = useTheme();

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
            <StyledTooltip title={disabled ? disabledTooltipText : ''}>
              <span>
                <IconButton aria-label="help" disabled edge="end" size="small">
                  <InfoOutlinedIcon
                    fontSize="small"
                    sx={{ color: active ? palette.primary.light : 'inherit' }}
                  />
                </IconButton>
              </span>
            </StyledTooltip>
          )
        }
      >
        <ListItemButton
          disabled={disabled}
          onClick={onClick}
          selected={active}
          sx={{ py: 0.5, borderRadius: 1 }}
        >
          {icon && (
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Icon
                component={getIcon(icon)}
                fontSize="small"
                sx={{ color: active ? palette.primary.light : 'inherit' }}
              />
            </ListItemIcon>
          )}
          <ListItemText
            primary={label}
            sx={{
              '::first-letter': { textTransform: 'uppercase' },
              span: { color: active ? palette.primary.light : 'inherit' },
            }}
          />
        </ListItemButton>
      </ListItem>
    </Box>
  );
};
