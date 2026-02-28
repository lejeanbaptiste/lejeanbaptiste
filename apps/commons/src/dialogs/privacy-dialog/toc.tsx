import { Box, Link, Stack, Typography } from '@mui/material';
import type { MarkdownHeading } from '@src/utilities';
import { useTranslation } from 'react-i18next';

export const Toc = ({ headings }: { headings: MarkdownHeading[] }) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ position: 'sticky', top: 50 }}>
      <Typography mb={2} variant="subtitle1">
        {t('LWC.on this page')}
      </Typography>
      <Stack component="nav">
        {headings
          .filter((heading) => heading.level > 1)
          .map((heading) => (
            <Link
              key={heading.id}
              mb={0.5}
              onClick={() =>
                document.getElementById(heading.slug)?.scrollIntoView({ behavior: 'smooth' })
              }
              pl={(heading.level - 2) * 2.5}
              sx={{ cursor: 'pointer' }}
              underline="hover"
              variant="body2"
            >
              {heading.title}
            </Link>
          ))}
      </Stack>
    </Box>
  );
};
