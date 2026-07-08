import { Icon, Button as MuiButton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { StyledToolTip } from '../../components';
import { getIcon } from '../../icons';

import { type MenuItem } from './';

export const Button = ({ icon, onClick, title, tooltip }: MenuItem) => {
  const theme = useTheme();

  return (
    <StyledToolTip enterDelay={2000} title={tooltip ?? title}>
      <MuiButton
        color="primary"
        onClick={onClick}
        startIcon={<Icon component={getIcon(icon)} fontSize="small" />}
        sx={[
          { height: 34, textTransform: 'capitalize' },
          theme.applyStyles('dark', { color: theme.vars.palette.text.primary }),
        ]}
      >
        {title}
      </MuiButton>
    </StyledToolTip>
  );
};
