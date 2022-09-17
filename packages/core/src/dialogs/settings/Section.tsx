import { Box, Stack, Typography } from '@mui/material';
import React, { type FC } from 'react';

interface SectionProps {
  title: string;
  children?: React.ReactNode;
}

const Section: FC<SectionProps> = ({ title, children }) => {
  return (
    <Stack direction="row">
      <Box
        display="flex"
        width="30%"
        justifyContent="flex-end"
        px={2}
        py={0.5}
        borderRight="1px solid"
      >
        <Typography>{title}</Typography>
      </Box>
      <Stack width="70%" px={1} spacing={1}>
        {children}
      </Stack>
    </Stack>
  );
};

export default Section;
