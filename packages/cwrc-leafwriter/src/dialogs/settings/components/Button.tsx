import { Icon, ListItem, ListItemButton, ListItemIcon, Stack, Typography } from '@mui/material';
import { getIcon, type IconLeafWriter } from '../../../icons';

interface ButtonProps extends React.PropsWithChildren {
  disabled?: boolean;
  description?: string;
  icon: IconLeafWriter;
  onClick: () => void;
}

export const Button = ({ children, disabled, description, icon, onClick }: ButtonProps) => (
  <ListItem dense disableGutters alignItems={description ? 'flex-start' : 'center'}>
    <ListItemButton
      disableGutters
      disabled={disabled}
      onClick={onClick}
      sx={{ alignItems: description ? 'flex-start' : 'center', py: 1, borderRadius: 1 }}
    >
      <ListItemIcon sx={{ minWidth: 36, mt: description ? 0.25 : 0 }}>
        <Icon component={getIcon(icon)} sx={{ mx: 1, height: 18, width: 18 }} />
      </ListItemIcon>

      <Stack>
        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
          {children}
        </Typography>
        {description && (
          <Typography color="text.secondary" variant="caption">
            {description}
          </Typography>
        )}
      </Stack>
    </ListItemButton>
  </ListItem>
);
