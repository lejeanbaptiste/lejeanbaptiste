import { Box, Skeleton, Typography } from '@mui/material';
import React from 'react';

type Props = {
  quantity?: number;
};

export const Skeletons = ({ quantity = 5 }: Props) => {
  const skels = new Array(quantity).fill(0);
  return (
    <Box>
      {skels.map((_sk, i) => (
        <Typography key={i} variant="h5" height={46} alignItems="center" m={1} px={2} pb={1}>
          <Skeleton variant="text" />
        </Typography>
      ))}
    </Box>
  );
};
