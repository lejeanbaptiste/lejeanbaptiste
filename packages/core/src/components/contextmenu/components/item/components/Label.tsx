import { Stack, Typography } from '@mui/material';
import React from 'react';

export interface LabelProps {
  fullName?: string;
  invalid?: boolean;
  name: string;
}

export const Label = ({ fullName, invalid, name }: LabelProps) => {
  return (
    <Stack sx={{ flexGrow: 1 }}>
      <Typography color={invalid ? 'text.secondary' : 'text.primary'} variant="body2">
        {name}
      </Typography>
      {fullName && (
        <Typography color="text.secondary" textTransform="capitalize" variant="caption">
          {fullName}
        </Typography>
      )}
    </Stack>
  );
};
