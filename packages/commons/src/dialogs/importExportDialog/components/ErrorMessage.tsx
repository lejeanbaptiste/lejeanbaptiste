import { Icon, Stack, Typography } from '@mui/material';
import { getIcon } from '@src/icons';
import React from 'react';

interface ErrorMessageProps {
  message: string;
}

export const ErrorMessage = ({ message }: ErrorMessageProps) => {
  return (
    <Stack direction="row" minHeight={220} alignItems="center" justifyContent="center" spacing={1}>
      <Icon component={getIcon('reportOutlinedIcon')} />
      <Typography sx={{ '::first-letter': { textTransform: 'uppercase' } }} variant="subtitle1">
        {message}
      </Typography>
    </Stack>
  );
};
