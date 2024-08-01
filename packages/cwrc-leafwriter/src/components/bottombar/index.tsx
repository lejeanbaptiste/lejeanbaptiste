import { Box, Link, Paper, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import pck from '../../../package.json';
import { useAppState } from '../../overmind';
import { ValdidationErrors } from './ValdidationErrors';
import AnnotationMode from './annotationMode';
import EditorMode from './editorMode';
import { Schema } from './schema';

export const BottomBar = () => {
  const { isReadonly } = useAppState().editor;
  const { validationErrors } = useAppState().validator;
  const { t } = useTranslation();
  const version = pck.version;

  return (
    <Paper
      elevation={0}
      square
      sx={{
        width: '100%',
        bgcolor: ({ palette }) => (palette.mode === 'dark' ? palette.background.paper : '#f5f5f5'),
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2} px={2}>
        {!isReadonly && (
          <>
            <EditorMode />
            <AnnotationMode />
            <Schema />
          </>
        )}

        {validationErrors > 0 && !isReadonly && <ValdidationErrors />}

        <Box flexGrow={1} />

        <Link
          color="text.secondary"
          variant="caption"
          href="https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer/-/issues/new?issuable_template=Bug%20Report"
          target="_blank"
        >
          {t('LW.Bugs')} / {t('LW.Requests')}
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
          title={t('LW.Powered by').toString()}
        >
          {t('LW.Powered by')} Tiny
        </Link>
      </Stack>
    </Paper>
  );
};
