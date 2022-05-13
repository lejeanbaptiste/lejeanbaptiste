import { Box, Container, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import Logo from '@src/components/Logo';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

const Header: FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box mt={isMobile ? 4 : 0} py={6}>
      <Container maxWidth="sm">
        <Stack justifyContent="center" alignItems="center">
          <Logo height={isMobile ? 40 : 70} sx={{ mb: isMobile ? 2 : 3 }} />
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

export default Header;
