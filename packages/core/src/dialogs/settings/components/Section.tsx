import { Box, List, Stack, Typography } from '@mui/material';
import React from 'react';

export interface SectionProps {
  children?: React.ReactNode;
  id: string;
  title: string;
}

export const Section = ({ children, id, title }: SectionProps) => {
  return (
    <Stack id={id}>
      <Box mt={1.5} px={2} py={0.5} borderBottom="1px solid">
        <Typography variant="subtitle1" sx={{ textTransform: 'capitalize' }}>
          {title}
        </Typography>
      </Box>
      <Stack px={1} spacing={1}>
        <List dense>{children}</List>
      </Stack>
    </Stack>
  );
};
