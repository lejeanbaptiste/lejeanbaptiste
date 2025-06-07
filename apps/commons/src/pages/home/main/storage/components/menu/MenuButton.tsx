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
import { motion } from 'motion/react';

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
    boxShadow: `0 0 2px ${theme.vars.palette.grey[300]}`,
    backgroundColor: theme.vars.palette.background.paper,
    color: theme.vars.palette.text.secondary,
    ...theme.applyStyles('dark', { boxShadow: 'none' }),
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
  const { vars } = useTheme();

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
                    sx={[active ? { color: vars.palette.primary.main } : { color: 'inherit' }]}
                  />
                </IconButton>
              </span>
            </StyledTooltip>
          )
        }
      >
        <ListItemButton
          disabled={disabled}
          onPointerDown={onClick}
          selected={active}
          sx={{ py: 0.5, borderRadius: 1 }}
        >
          {icon && (
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Icon
                component={getIcon(icon)}
                fontSize="small"
                sx={[active ? { color: vars.palette.primary.main } : { color: 'inherit' }]}
              />
            </ListItemIcon>
          )}
          <ListItemText
            primary={label}
            sx={[
              {
                '::first-letter': { textTransform: 'uppercase' },
              },
              active && {
                span: { color: vars.palette.primary.main },
              },
            ]}
          />
        </ListItemButton>
      </ListItem>
    </Box>
  );
};
