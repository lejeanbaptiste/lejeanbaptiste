import { Box, Link, Paper, Stack } from '@mui/material';
import React, { type FC } from 'react';
import AnnotationMode from './AnnotationMode';
import EditorMode from './EditorMode';
import Schema from './Schema';

const BottomBar: FC = () => {
  const version = 'dev'; //webpackEnv?.LEAFWRITER_VERSION ?? '';

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
          href={`https://github.com/cwrc/CWRC-WriterBase/releases/tag/v${version}`}
          rel="noopener"
          target="_blank"
          title="GitHub Release Notes"
        >
          {`LEAF-Writer ${version}`}
        </Link>
        <Link
          color="text.secondary"
          variant="caption"
          href="https://www.tiny.cloud"
          target="_blank"
          rel="noopener"
          title="Powered by Tiny"
        >
          Powered by Tiny
        </Link>
      </Stack>
    </Paper>
  );
};

export default BottomBar;
