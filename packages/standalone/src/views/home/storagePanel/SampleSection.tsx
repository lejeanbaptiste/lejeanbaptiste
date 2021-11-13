import { Box, Button, Stack, Typography } from '@mui/material';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

interface SampleFile {
  name: string;
  uri: string;
}

const sampleFiles: SampleFile[] = [
  { name: 'TEI Letter', uri: '' },
  { name: 'TEI Poem', uri: '' },
];

const SampleSection: FC = () => {
  const { t } = useTranslation();

  return (
    <Box>
      <Stack direction="row" justifyContent="center" alignItems="baseline" spacing={2}>
        <Typography align="center" component="h6" variant="subtitle1" mr={3}>
          {t('home:orTrySample')}
        </Typography>
        {sampleFiles.map(({ name, uri }) => (
          <Button key={name}>{name}</Button>
        ))}
      </Stack>
    </Box>
  );
};

export default SampleSection;
