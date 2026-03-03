import { Box, Stack, Typography } from '@mui/material';
import type { Toc as TOC } from '@stefanprobst/rehype-extract-toc';
import { useTranslation } from 'react-i18next';
import { Item } from './item';

export const Toc = ({ headings }: { headings: TOC }) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ position: 'sticky', top: 50 }}>
      <Typography mb={2} variant="subtitle1">
        {t('LWC.on this page')}
      </Typography>
      <Stack component="nav">
        {headings[0]?.children?.map((heading) => (
          <Item key={heading.id} heading={heading} />
        ))}
      </Stack>
    </Box>
  );
};
