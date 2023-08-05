import { Box, Container, Grid, rgbToHex, useTheme } from '@mui/material';
import chroma from 'chroma-js';
import React, { useMemo } from 'react';
import { About } from './About';
import { Team } from './Team';

export const AboutSection = () => {
  const { mode, primary } = useTheme().palette;

  const bgcolor = useMemo(
    () =>
      chroma
        .hex(rgbToHex(primary.main))
        .alpha(mode === 'dark' ? 0.04 : 0.06)
        .hex(),
    [mode]
  );

  return (
    <Box id="about" py={10} px={2} sx={{ bgcolor }}>
      <Container maxWidth="lg">
        <Grid container columnSpacing={12} rowSpacing={4} mb={5}>
          <Grid item xs={12} sm={7} md={8}>
            <About />
          </Grid>
          <Grid item xs={12} sm={5} md={4}>
            <Team />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};
