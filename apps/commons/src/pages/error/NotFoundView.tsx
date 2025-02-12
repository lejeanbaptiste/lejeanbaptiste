import { Box, Link, Stack, Typography } from '@mui/material';
import { Logo } from '@src/components';
import { Page } from '@src/layouts';
import { Trans, useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';

export const NotFoundPage = () => {
  const { t } = useTranslation();

  return (
    <Page title={t('LWC.error.page_not_Found')}>
      <Stack justifyContent="center" alignItems="center" py={8}>
        <Logo height={70} sx={{ mb: 4, opacity: 0.7 }} />
        <Typography align="center" component="h2" mb={2} variant="h4">
          Page not found
        </Typography>
        <Box maxWidth={350}>
          <Typography align="center">
            <Trans i18nKey="LWC.error.message404">
              You either tried some shady route or you came here by mistake. Go back to the{' '}
              <Link component={RouterLink} to="/" underline="hover">
                main page.
              </Link>
            </Trans>
          </Typography>
        </Box>
        <Stack textAlign="center" mt={3}>
          <img alt="Absurd Illustration" src="/assets/images/07.png" style={{ width: 400 }} />
          <Typography variant="caption">
            Illustration from{' '}
            <Link underline="hover" href="https://absurd.design" target="_blank" rel="noopener">
              absurd.design
            </Link>
          </Typography>
        </Stack>
      </Stack>
    </Page>
  );
};
