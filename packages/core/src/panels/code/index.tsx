import { Button, IconButton, Paper, Stack, ToggleButton, Tooltip } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions } from '../../overmind';
import { Editor } from './Editor';
import ShareIcon from '@mui/icons-material/Share';

export const CodePanel = () => {
  const { openDialog } = useActions().ui;
  const { writer } = window;

  const { t } = useTranslation();

  const [showLOD, setShowLOD] = useState(false);

  const handleClickEditXml = async () => {
    const docText = await writer.converter.getDocumentContent(true);
    if (!docText) return;
    openDialog({ type: 'editSource', props: { content: docText } });
  };

  const handleClickShowLODAnnotation = () => setShowLOD(!showLOD);

  return (
    <Paper
      id="code-panel"
      elevation={5}
      square
      sx={{
        overflow: 'auto',
        height: '100%',
        p: 1,
        bgcolor: ({ palette }) => (palette.mode === 'dark' ? palette.background.paper : '#f5f5f5'),
      }}
    >
      <Stack direction="column" gap={1}>
        <Editor showLOD={showLOD} />
        <Stack direction="row" justifyContent="space-between">
          <Tooltip enterDelay={1000} title={t('leafwriter:show_lod_annotation')}>
            <ToggleButton
              color="secondary"
              onChange={handleClickShowLODAnnotation}
              selected={showLOD}
              size="small"
              sx={{ height: 28 }}
              value="check"
            >
              <ShareIcon fontSize="inherit" />
            </ToggleButton>
          </Tooltip>
          <Tooltip enterDelay={1000} title={t('leafwriter:edit_raw_xml')}>
            <Button onClick={handleClickEditXml} size="small" sx={{ height: 28 }}>
              {t('leafwriter:commons.edit')}
            </Button>
          </Tooltip>
        </Stack>
      </Stack>
    </Paper>
  );
};
