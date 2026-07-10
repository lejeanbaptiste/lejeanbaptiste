import {
  Checkbox,
  ListItem,
  ListItemButton,
  ListItemIcon,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { Icon, type IconLeafWriter } from '../../../icons';

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
        alignItems="center"
        disabled={disabled}
        disableGutters
        onClick={handleClick}
        sx={[
          { minHeight: 26, py: 0, borderRadius: 1 },
          !!description && { alignItems: 'flex-start' },
        ]}
      >
        <ListItemIcon sx={[{ minWidth: 22, mt: 0 }, !!description && { mt: 0.1 }]}>
          <Icon name={icon} sx={{ mx: 0.25, height: 14, width: 14 }} />
        </ListItemIcon>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems={description ? 'flex-start' : 'center'}
          flexGrow={1}
        >
          <Stack>
            <Typography variant="body2" sx={{ fontSize: '0.86rem', lineHeight: 1.2 }}>
              {title}
            </Typography>
            {description && (
              <Typography color="textSecondary" variant="caption" sx={{ lineHeight: 1.15 }}>
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
