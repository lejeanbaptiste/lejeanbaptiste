import { Box, Container } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { About } from './About';
import { Team } from './Team';

export const AboutSection = () => {
  return (
    <Box
      id="about"
      py={10}
      px={2}
      sx={[
        {
          backgroundColor: (theme) => `rgba(${theme.vars.palette.primary.mainChannel} / 0.06)`,
          scrollMarginBlockStart: 300,
        },
        (theme) =>
          theme.applyStyles('dark', {
            backgroundColor: `rgba(${theme.vars.palette.primary.mainChannel} / 0.04)`,
          }),
      ]}
    >
      <Container maxWidth="lg">
        <Grid container columnSpacing={12} rowSpacing={4} mb={5}>
          <Grid size={{ xs: 12, sm: 7, md: 8 }}>
            <About />
          </Grid>
          <Grid size={{ xs: 12, sm: 5, md: 4 }}>
            <Team />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};
