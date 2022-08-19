import { Box, Container, Grid, useTheme, rgbToHex } from '@mui/material';
import React, { FC, useMemo } from 'react';
import About from './About';
import Team from './Team';
import chroma from 'chroma-js';

const AboutSction: FC = () => {
  const { mode, primary } = useTheme().palette;

  const backgroundColor = useMemo(
    () =>
      chroma
        .hex(rgbToHex(primary.main))
        .alpha(mode === 'dark' ? 0.04 : 0.06)
        .hex(),
    [mode]
  );

  return (
    <Box py={10} px={2} sx={{ backgroundColor }}>
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

export default AboutSction;
