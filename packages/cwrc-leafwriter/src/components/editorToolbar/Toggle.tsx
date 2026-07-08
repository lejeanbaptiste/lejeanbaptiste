import { Icon, ToggleButton, useTheme } from '@mui/material';
import { StyledToolTip } from '../../components';
import { getIcon } from '../../icons';

import { type MenuItem } from './';

export const Toggle = ({ icon, onClick, selected, title }: MenuItem) => {
  const theme = useTheme();

  return (
    <StyledToolTip enterDelay={2000} title={title}>
      <ToggleButton
        aria-label={title}
        onClick={onClick}
        selected={selected}
        size="small"
        sx={[
          {
            width: 34,
            height: 34,
            borderRadius: 1,
            border: 'none',
            color: (theme) => theme.vars.palette.primary.main,
          },
          theme.applyStyles('dark', {
            color: theme.vars.palette.text.primary,
          }),
        ]}
        value="check"
      >
        <Icon component={getIcon(icon)} fontSize="small" />
      </ToggleButton>
    </StyledToolTip>
  );
};
