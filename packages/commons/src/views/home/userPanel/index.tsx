import {
  Box,
  Grid,
  Container,
  Divider,
  Paper,
  Skeleton,
  Stack,
  useMediaQuery,
  useTheme,
  Typography,
} from '@mui/material';
import { useAppState } from '@src/overmind';
import { AnimatePresence, motion } from 'framer-motion';
import React, { FC } from 'react';
import Logo from '@src/components/Logo';
import { useTranslation } from 'react-i18next';
// import OpenOptions from './OpenOptions';
// import Recent from './Recent';
// import Templates from './Templates';
// import SampleSection from './SampleSection';

const userPanel: FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { userAuthenticated } = useAppState();

  const conainerVariants = {
    initial: { height: 0 },
    visible: { height: 'auto' },
    exit: { height: 0 },
  };

  return (
    <Box
      height={600}
      pt={10}
      sx={{
        backgroundImage:
          'linear-gradient(to right top, #051937, #004d7a, #008793, #00bf72, #a8eb12)',
      }}
    >
      <Container maxWidth="lg">
        <Grid container>
          <Grid item md={4}>
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
          </Grid>
          <Grid item md={4}></Grid>
          <Grid item md={4}></Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default userPanel;
