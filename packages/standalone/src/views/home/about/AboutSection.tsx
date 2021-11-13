import { Box, Container, Grid } from '@mui/material';
import React, { FC } from 'react';
import About from './About';
import Team from './Team';

const AboutSction: FC = () => (
  <Box py={20} px={2}>
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

export default AboutSction;
