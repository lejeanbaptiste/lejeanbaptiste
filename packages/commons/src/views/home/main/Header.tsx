import { Box, Container, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Logo } from '@src/components';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';

export const Header: FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box mt={isMobile ? 4 : 0} py={3}>
      <Container maxWidth="md">
        <Stack justifyContent="center" alignItems="center">
          <Logo height={isMobile ? 140 : 230} sx={{ mb: isMobile ? 2 : 2 }} variant="vertical" />
          <Typography
            align="center"
            component="h2"
            sx={{ fontWeight: 300 }}
            variant={isMobile ? 'subtitle1' : 'h5'}
          >
            {t('home:subtitle')}
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
};
