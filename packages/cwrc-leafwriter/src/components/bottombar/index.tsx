import { Box, Link, Paper, Stack } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import pck from '../../../package.json';
import { PrivacyDialog } from '../../dialogs/privacy-dialog';
import { useAppState } from '../../overmind';
import { AuthorityLoadIndicator } from './AuthorityLoadIndicator';
import { AiRunIndicator } from './AiRunIndicator';
import { ValdidationErrors } from './ValdidationErrors';
import AnnotationMode from './annotationMode';
import EditorMode from './editorMode';
import { Schema } from './schema';
import { EditorZoomControls } from './sourceView/EditorZoomControls';
import { SourceView } from './sourceView';

const isDesktopApp = () =>
  typeof window !== 'undefined' && !!(window as Window & { electronAPI?: unknown }).electronAPI;

export const BottomBar = () => {
  const { isReadonly } = useAppState().editor;
  const { validationErrors } = useAppState().validator;
  const { t } = useTranslation();
  const version = pck.version;
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);
  const desktop = isDesktopApp();

  return (
    <Paper
      elevation={0}
      square
      sx={[
        { width: '100%', backgroundColor: '#f5f5f5' },
        (theme) =>
          theme.applyStyles('dark', { backgroundColor: theme.vars.palette.background.paper }),
      ]}
    >
      {!desktop && (
        <PrivacyDialog onClose={() => setPrivacyDialogOpen(false)} open={privacyDialogOpen} />
      )}
      <Stack direction="row" alignItems="center" spacing={1} px={1}>
        {!isReadonly && (
          <>
            <EditorMode />
            <AnnotationMode />
            <Schema />
            <SourceView />
            <EditorZoomControls />
          </>
        )}

        {validationErrors > 0 && !isReadonly && <ValdidationErrors />}

        <Box flexGrow={1} />

        <AuthorityLoadIndicator />
        <AiRunIndicator />

        {!desktop && (
          <>
            <Link
              component="button"
              color="textSecondary"
              onClick={() => setPrivacyDialogOpen(true)}
              variant="caption"
            >
              {t('LW.commons.Privacy Policy')}
            </Link>

            <Link
              color="textSecondary"
              variant="caption"
              href="https://github.com/lejeanbaptiste/lejeanbaptiste/issues/new"
              target="_blank"
            >
              {t('LW.Bugs')} / {t('LW.Requests')}
            </Link>

            <Link
              color="textSecondary"
              variant="caption"
              href={pck.homepage}
              rel="noopener"
              target="_blank"
              title="Repository"
            >
              {`v${version}`}
            </Link>
          </>
        )}
      </Stack>
    </Paper>
  );
};
