import { Link, Stack, Typography } from '@mui/material';
import type { LatestCommit } from '@src/types/Provider';
import { motion, type Variants } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface ContentDetailsProps {
  latestCommit: LatestCommit;
}

export const ContentDetails = ({ latestCommit }: ContentDetailsProps) => {
  const { t } = useTranslation();

  const variants: Variants = {
    initial: { height: 0 },
    visible: { height: 'auto' },
  };
  return (
    <Stack
      component={motion.div}
      variants={variants}
      initial="initial"
      animate="visible"
      exit="initial"
      data-testid="content-details"
      pt={0.25}
    >
      <Typography sx={{ '&::first-letter': { textTransform: 'uppercase' } }}>
        <Typography variant="caption">{t('SS.commons.last_modified').toString()}: </Typography>
        <Typography color="text.secondary" title={latestCommit.date} variant="caption">
          {latestCommit.relativeDate} {t('SS.commons.by')}{' '}
        </Typography>
        <Typography
          color="text.secondary"
          component={Link}
          href={`mailto:${latestCommit.authorEmail}`}
          title={`${latestCommit.authorName} (${latestCommit.authorEmail})`}
          underline="hover"
          variant="caption"
        >
          {latestCommit.authorName}
        </Typography>
      </Typography>
      <Typography sx={{ '&::first-letter': { textTransform: 'uppercase' } }}>
        <Typography variant="caption">{t('SS.commons.message')}: </Typography>
        <Typography color="text.secondary" data-testid="message" variant="caption">
          {latestCommit.message}{' '}
        </Typography>
        <Typography
          color="text.secondary"
          component={Link}
          href={latestCommit.html_url}
          rel="noreferrer"
          sx={{ ':before': { content: '"("' }, ':after': { content: '")"' } }}
          target="_blank"
          title={latestCommit.html_url}
          underline="hover"
          variant="caption"
        >
          {t('SS.cloud.view_source')}
        </Typography>
      </Typography>
    </Stack>
  );
};
