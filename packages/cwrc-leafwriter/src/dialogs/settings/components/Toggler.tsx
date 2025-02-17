import {
  Checkbox,
  Icon,
  ListItem,
  ListItemButton,
  ListItemIcon,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { getIcon, type IconLeafWriter } from '../../../icons';

type TogglerProps = {
  description?: string;
  disabled?: boolean;
  icon: IconLeafWriter;
  onChange: (value: boolean) => void;
  title: string;
  type?: 'checkbox' | 'toggle';
  value: boolean;
};

export const Toggler = ({
  description,
  disabled,
  icon,
  onChange,
  title,
  type = 'checkbox',
  value,
}: TogglerProps) => {
  const handleClick = () => onChange(!value);
  return (
    <ListItem dense disableGutters alignItems={description ? 'flex-start' : 'center'}>
      <ListItemButton
        disabled={disabled}
        disableGutters
        onClick={handleClick}
        sx={[
          {
            py: 1,
            borderRadius: 1,
            alignItems: 'center',
          },
          !!description && { alignItems: 'flex-start' },
        ]}
      >
        <ListItemIcon
          sx={[
            {
              minWidth: 36,
              mt: 0,
            },
            !!description && { mt: 0.25 },
          ]}
        >
          <Icon component={getIcon(icon)} sx={{ mx: 1, height: 18, width: 18 }} />
        </ListItemIcon>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems={description ? 'flex-start' : 'center'}
          flexGrow={1}
        >
          <Stack>
            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
              {title}
            </Typography>
            {description && (
              <Typography color="textSecondary" variant="caption">
                {description}
              </Typography>
            )}
          </Stack>
          {type === 'checkbox' ? (
            <Checkbox
              checked={value}
              disabled={disabled}
              disableFocusRipple
              disableRipple
              size="small"
              sx={{ py: 0 }}
            />
          ) : (
            <Switch
              checked={value}
              disabled={disabled}
              disableFocusRipple
              disableRipple
              size="small"
              value={value}
            />
          )}
        </Stack>
      </ListItemButton>
    </ListItem>
  );
};
