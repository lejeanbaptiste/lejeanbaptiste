import { Divider, Stack, Typography } from '@mui/material';
import React, { type FC } from 'react';

interface ICategory {
  children: React.ReactNode;
  title: string;
}

export const Category: FC<ICategory> = ({ children, title }) => {
  return (
    <Stack spacing={2} px={2} py={2}>
      <Typography
        fontWeight={700}
        letterSpacing=".15rem"
        textTransform="uppercase"
        variant="subtitle1"
      >
        {title}
      </Typography>
      <Divider />
      <Stack direction="row" flexWrap="wrap" gap={3}>
        {children}
      </Stack>
    </Stack>
  );
};
