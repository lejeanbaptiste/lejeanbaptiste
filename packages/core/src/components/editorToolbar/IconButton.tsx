import { Icon, IconButton as MuiIconButton, Tooltip, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyledToolTip } from '../../components';
import { getIcon } from '../../icons';

import { type MenuItem } from './';

export const IconButton = ({ color, disabled, icon, onClick, title, tooltip }: MenuItem) => {
  const { palette } = useTheme();
  const {t}  = useTranslation()

  let tip = `${tooltip ?? title}`;
  if (disabled) tip += ` - ${t('leafwriter:not_supported')}`;

  return (
    <StyledToolTip enterDelay={2000} title={tip}>
      <span>
        <MuiIconButton
          aria-label={title}
          disabled={disabled}
          color="primary"
          onClick={onClick}
          size="small"
          sx={{
            width: 34,
            height: 34,
            borderRadius: 1,
            '&:hover': { color: color ?? palette.primary.main },
          }}
        >
          <Icon component={getIcon(icon)} fontSize="small" />
        </MuiIconButton>
      </span>
    </StyledToolTip>
  );
};
