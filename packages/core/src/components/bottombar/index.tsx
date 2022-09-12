import { Box, Link, Paper, Stack } from '@mui/material';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import pck from '../../../package.json';
import AnnotationMode from './AnnotationMode';
import EditorMode from './EditorMode';
import Schema from './Schema';

const BottomBar: FC = () => {
  const { t } = useTranslation();
  const version = pck.version;

  return (
    <Paper
      elevation={0}
      square
      sx={{
        width: '100%',
        backgroundColor: ({ palette }) =>
          palette.mode === 'dark' ? palette.background.paper : '#f5f5f5',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2} px={2}>
        <EditorMode />
        <AnnotationMode />
        <Schema />

        <Box flexGrow={1} />

        <Link
          color="text.secondary"
          variant="caption"
          href="https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer/-/issues/new?issuable_template=Bug%20Report"
          target="_blank"
        >
          {t('Bugs')} / {t('Requests')}
        </Link>

        <Link
          color="text.secondary"
          variant="caption"
          href={pck.homepage}
          rel="noopener"
          target="_blank"
          title="Repository"
        >
          {`LEAF-Writer ${version}`}
        </Link>
        <Link
          color="text.secondary"
          variant="caption"
          href="https://www.tiny.cloud"
          target="_blank"
          rel="noopener"
          title={t('Powered by')}
        >
          {t('Powered by')} Tiny
        </Link>
      </Stack>
    </Paper>
  );
};

export default BottomBar;
