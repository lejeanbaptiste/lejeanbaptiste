import { Container, Grid, Stack, Typography } from '@mui/material';
import { ContainerCompiledMdxContent } from '@src/components/mdx';
import { useAppState } from '@src/overmind';
import { useTranslation } from 'react-i18next';
import { TeamProfile } from './team-profile';
import { getAboutContent } from './utils';

export const AboutSection = () => {
  const { currentLocale } = useAppState().ui;
  const { t } = useTranslation();

  const data = getAboutContent(currentLocale);

  return (
    <Container id="about" maxWidth="lg" sx={{ py: 10, px: 2 }}>
      <Grid container columnSpacing={12} rowSpacing={4} mb={5}>
        <Grid size={{ xs: 12, sm: 7, md: 8 }}>
          <ContainerCompiledMdxContent content={data.content} />
        </Grid>
        {data.frontmatter.team && (
          <Grid size={{ xs: 12, sm: 5, md: 4 }}>
            <Typography
              component="h3"
              pt={{ xs: 4, sm: 6 }}
              variant="h5"
              sx={{ textTransform: 'capitalize' }}
            >
              {t('LWC.home.team')}
            </Typography>
            <Stack mt={4} rowGap={2.5}>
              {data.frontmatter.team.map((profile) => (
                <TeamProfile key={profile.name} profile={profile} />
              ))}
            </Stack>
          </Grid>
        )}
      </Grid>
    </Container>
  );
};
