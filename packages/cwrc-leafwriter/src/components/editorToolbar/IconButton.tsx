import { Icon, IconButton as MuiIconButton, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { StyledToolTip } from '../../components';
import { getIcon } from '../../icons';

import { type MenuItem } from './';

export const IconButton = ({ color, disabled, icon, onClick, title, tooltip }: MenuItem) => {
  const theme = useTheme();
  const { t } = useTranslation();

  let tip = `${tooltip ?? title}`;
  if (disabled) tip += ` - ${t('LW.not supported')}`;

  return (
    <StyledToolTip enterDelay={2000} title={tip}>
      <span>
        <MuiIconButton
          aria-label={title}
          disabled={disabled}
          color="primary"
          onClick={onClick}
          onMouseDown={(e) => e.preventDefault()}
          size="small"
          sx={[
            {
              width: 34,
              height: 34,
              borderRadius: 1,
              '&:hover': { color: color ?? theme.vars.palette.primary.main },
            },
            theme.applyStyles('dark', {
              color: theme.vars.palette.text.primary,
              '&:hover': { color: theme.vars.palette.text.primary },
            }),
          ]}
        >
          <Icon component={getIcon(icon)} fontSize="small" />
        </MuiIconButton>
      </span>
    </StyledToolTip>
  );
};
