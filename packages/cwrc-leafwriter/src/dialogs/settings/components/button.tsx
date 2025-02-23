import { ListItem, ListItemButton, ListItemIcon, Stack, Typography } from '@mui/material';
import { Icon, type IconLeafWriter } from '../../../icons';

interface ButtonProps extends React.PropsWithChildren {
  description?: string;
  disabled?: boolean;
  icon: IconLeafWriter;
  onClick: () => void;
}

export const Button = ({ children, description, disabled, icon, onClick }: ButtonProps) => (
  <ListItem dense disableGutters alignItems={description ? 'flex-start' : 'center'}>
    <ListItemButton
      alignItems="center"
      disableGutters
      disabled={disabled}
      onClick={onClick}
      sx={[{ py: 1, borderRadius: 1 }, !!description && { alignItems: 'flex-start' }]}
    >
      <ListItemIcon sx={[{ minWidth: 36, mt: 0 }, !!description && { mt: 0.25 }]}>
        <Icon name={icon} sx={{ mx: 1, height: 18, width: 18 }} />
      </ListItemIcon>
      <Stack>
        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
          {children}
        </Typography>
        {description && (
          <Typography color="textSecondary" variant="caption">
            {description}
          </Typography>
        )}
      </Stack>
    </ListItemButton>
  </ListItem>
);
