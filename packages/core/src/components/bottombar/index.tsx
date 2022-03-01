import { Box, Link, Paper, Stack } from '@mui/material';
import React, { FC } from 'react';
import { webpackEnv } from '../../@types';
import AnnotationMode from './AnnotationMode';
import EditorMode from './EditorMode';
import Schema from './Schema';

const BottomBar: FC = () => {
  const version = webpackEnv.LEAFWRITER_VERSION; //'1.0.0' //pkg.version;

  return (
    <Box bottom={0} position="fixed" width="100vw">
      <Paper elevation={8} square>
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
            {`leaf writer ${version}`}
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
    </Box>
  );
};

export default BottomBar;
